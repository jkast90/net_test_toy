"""
Base Repository with Database Connection Management
Handles connection, migrations, and table creation
"""
import sqlite3
import os
import logging
from pathlib import Path
from typing import Optional


logger = logging.getLogger(__name__)


class BaseRepository:
    """Base repository class with shared database connection logic"""

    def __init__(self, db_path: Optional[str] = None):
        """Initialize database connection"""
        # Use environment variable, fallback to default shared location
        if db_path is None:
            db_path = os.getenv("CONTAINER_DB_PATH", "/app/data/container_manager.db")

        # Ensure directory exists
        db_dir = Path(db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)

        self.db_path = db_path
        self.conn = None
        self._connect()

    def _connect(self):
        """Establish database connection"""
        try:
            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row  # Return rows as dictionaries
            # Enable foreign key support
            self.conn.execute("PRAGMA foreign_keys = ON")
            logger.info(f"Connected to database: {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()

    def _row_to_dict(self, row):
        """Convert sqlite3.Row to dict"""
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows):
        """Convert list of sqlite3.Row to list of dicts"""
        return [dict(row) for row in rows]
