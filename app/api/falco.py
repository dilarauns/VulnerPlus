from fastapi import APIRouter, Query, Request
from app.services.log_reader import read_falco_logs, analyze_logs_ollama
from datetime import datetime
import json
import os
import sqlite3

router = APIRouter()

def get_db_connection():
    conn = sqlite3.connect('app/data/falco.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Create falco_logs table if it doesn't exist
    c.execute('''
        CREATE TABLE IF NOT EXISTS falco_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            log_json TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()

#TODO: Filtreleme geldikten sonra sorgular nasil olacak? 

def insert_falco_log(log_data):
    conn = get_db_connection()
    c = conn.cursor()
    
    # Convert dict to JSON string
    log_json = json.dumps(log_data)
    
    c.execute('INSERT INTO falco_logs (log_json) VALUES (?)', (log_json,))
    conn.commit()
    conn.close()

def get_recent_logs(limit=10):
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('SELECT * FROM falco_logs ORDER BY created_at DESC LIMIT ?', (limit,))
    logs = c.fetchall()
    
    # Convert JSON strings back to dicts
    result = []
    for log in logs:
        log_dict = dict(log)
        log_dict['log_json'] = json.loads(log_dict['log_json'])
        result.append(log_dict)
    
    conn.close()
    return result

@router.get("/falco")
def get_falco_logs(lines: int = 10, analyze: bool = Query(False, description="AI ile analiz et")):
    """
    Son N adet Falco logunu getir. 
    Eğer `analyze=true` verilirse, loglar AI ile analiz edilir.
    """
    logs = read_falco_logs(lines)
    
    if not logs or isinstance(logs, dict) and "error" in logs:
        return {"error": "Falco logları okunamadı veya mevcut değil."}

    if analyze:
        analyzed_logs = analyze_logs_ollama(logs)
        return {"analyzed_logs": analyzed_logs}
    
    return {"logs": logs}

@router.post("/falco/logs")
async def receive_falco_logs(request: Request):
    """
    Receive JSON logs directly from Falco and store them in SQLite database.
    """
    try:
        # Get the JSON data from the request
        log_data = await request.json()
        
        # Store in database
        insert_falco_log(log_data)
            
        return {
            "status": "success",
            "message": "Log data received and stored in database"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to process log data: {str(e)}"
        }

@router.get("/falco/events")
async def get_falco_events(
    limit: int = Query(10, description="Number of logs to retrieve"),
    offset: int = Query(0, description="Number of logs to skip"),
    sort_order: str = Query("desc", description="Sort order (asc or desc)"),
    priority: str = Query(None, description="Filter by priority (Critical, Warning, Info)"),
    time_range: str = Query("24h", description="Time range (24h, 7d, 30d)")
):
    """
    Get Falco events from the database with pagination, time-based sorting and priority filtering
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Validate sort_order parameter
        if sort_order not in ["asc", "desc"]:
            sort_order = "desc"
        
        # Build the WHERE clause for filtering
        where_conditions = []
        params = []
        
        # Priority filter
        if priority:
            where_conditions.append("json_extract(log_json, '$.priority') = ?")
            params.append(priority)
        
        # Get the earliest and latest timestamps from the database
        c.execute("SELECT MIN(json_extract(log_json, '$.time')) as min_time, MAX(json_extract(log_json, '$.time')) as max_time FROM falco_logs")
        time_bounds = c.fetchone()
        latest_time = time_bounds['max_time']
        
        if latest_time and time_range:
            # Use the latest time as reference point instead of 'now'
            if time_range == "24h":
                where_conditions.append(
                    "datetime(substr(json_extract(log_json, '$.time'), 1, 19)) >= datetime(substr(?, 1, 19), '-1 day')"
                )
                params.append(latest_time)
            elif time_range == "7d":
                where_conditions.append(
                    "datetime(substr(json_extract(log_json, '$.time'), 1, 19)) >= datetime(substr(?, 1, 19), '-7 days')"
                )
                params.append(latest_time)
            elif time_range == "30d":
                where_conditions.append(
                    "datetime(substr(json_extract(log_json, '$.time'), 1, 19)) >= datetime(substr(?, 1, 19), '-30 days')"
                )
                params.append(latest_time)
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Get total count with filters
        count_query = f"SELECT COUNT(*) as count FROM falco_logs WHERE {where_clause}"
        c.execute(count_query, params)
        total_count = c.fetchone()['count']
        
        # Get paginated logs with time-based sorting and filtering
        query = f"""
            SELECT id, log_json 
            FROM falco_logs 
            WHERE {where_clause}
            ORDER BY datetime(substr(json_extract(log_json, '$.time'), 1, 19)) {sort_order}
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        c.execute(query, params)
        
        logs = c.fetchall()
        
        # Convert JSON strings back to dicts
        result = []
        for log in logs:
            log_dict = dict(log)
            try:
                log_dict['log_json'] = json.loads(log_dict['log_json'])
                # Print first log for debugging
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                continue
            result.append(log_dict)
        
        conn.close()
        
        return {
            "status": "success",
            "total": total_count,
            "logs": result
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to retrieve logs: {str(e)}"
        }

@router.get("/falco/dashboard")
async def get_dashboard_stats(
    priority: str = Query(None, description="Filter by priority (Critical, Warning, Notice)"),
    rule: str = Query(None, description="Filter by rule name"),
    tag: str = Query(None, description="Filter by tag name"),
    time_range: str = Query("24h", description="Time range (24h, 7d, 30d)")
):
    """
    Dashboard için gerekli istatistikleri döndürür
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()

        # Build where clause based on filters
        where_conditions = []
        params = []
        
        if priority:
            where_conditions.append("json_extract(log_json, '$.priority') = ?")
            params.append(priority)
        
        if rule:
            where_conditions.append("json_extract(log_json, '$.rule') = ?")
            params.append(rule)
            
        if tag:
            where_conditions.append("json_extract(log_json, '$.tags') LIKE ?")
            params.append(f"%{tag}%")

        # Time range filter
        time_filter = "datetime('now', '-1 day')"
        if time_range == "7d":
            time_filter = "datetime('now', '-7 days')"
        elif time_range == "30d":
            time_filter = "datetime('now', '-30 days')"
            
        where_conditions.append(f"json_extract(log_json, '$.time') >= {time_filter}")
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"

        # Priority distribution with filters
        c.execute(f'''
            SELECT json_extract(log_json, '$.priority') as priority,
            COUNT(*) as count
            FROM falco_logs
            WHERE {where_clause}
            GROUP BY priority
        ''', params)
        priorities = dict(c.fetchall())

        # Rule distribution with filters
        c.execute(f'''
            SELECT json_extract(log_json, '$.rule') as rule,
            COUNT(*) as count
            FROM falco_logs
            WHERE {where_clause}
            GROUP BY rule
            ORDER BY count DESC
        ''', params)
        rules = dict(c.fetchall())

        # Tag distribution with filters
        c.execute(f'''
            SELECT 
                json_extract(log_json, '$.tags') as tags
            FROM falco_logs
            WHERE {where_clause} AND json_extract(log_json, '$.tags') IS NOT NULL
        ''', params)
        
        tags = {}
        for row in c.fetchall():
            try:
                tag_list = json.loads(row['tags'])
                for tag in tag_list:
                    tags[tag] = tags.get(tag, 0) + 1
            except:
                continue

        # Timeline with filters
        c.execute(f'''
            SELECT 
                strftime('%Y-%m-%d %H:00:00', json_extract(log_json, '$.time')) as hour,
                json_extract(log_json, '$.priority') as priority,
                COUNT(*) as count
            FROM falco_logs
            WHERE {where_clause}
            GROUP BY hour, priority
            ORDER BY hour
        ''', params)
        timeline = {}
        for row in c.fetchall():
            hour, priority, count = row
            if hour not in timeline:
                timeline[hour] = {}
            timeline[hour][priority] = count

        conn.close()

        return {
            "status": "success",
            "statistics": {
                "priorities": priorities,
                "rules": rules,
                "timeline_priority": timeline,
                "tags": tags
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to retrieve dashboard statistics: {str(e)}"
        }


