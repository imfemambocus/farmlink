from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from core.security import get_db


router = APIRouter()


@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    return {"tables": tables}


@router.get("/tables/{table_name}")
def get_table_data(table_name: str, limit: int = 50, db: Session = Depends(get_db)):
    try:
        result = db.execute(text(f"SELECT * FROM {table_name} LIMIT {limit}"))
        columns = result.keys()
        rows = result.fetchall()

        data = []
        for row in rows:
            data.append(dict(zip(columns, row)))

        return {
            "table": table_name,
            "count": len(data),
            "columns": list(columns),
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))