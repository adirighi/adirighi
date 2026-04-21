import sqlite3
from datetime import datetime

DB_PATH = "finance.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense'))
        );
    """)
    # Seed default categories
    defaults = [
        ("Gehalt", "income"), ("Nebeneinkommen", "income"), ("Investitionen", "income"),
        ("Sonstiges Einkommen", "income"),
        ("Miete", "expense"), ("Lebensmittel", "expense"), ("Transport", "expense"),
        ("Gesundheit", "expense"), ("Unterhaltung", "expense"), ("Kleidung", "expense"),
        ("Versicherung", "expense"), ("Bildung", "expense"), ("Restaurant", "expense"),
        ("Sonstiges", "expense"),
    ]
    for name, typ in defaults:
        conn.execute(
            "INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)", (name, typ)
        )
    conn.commit()
    conn.close()


def get_transactions(month=None, year=None, type_filter=None):
    conn = get_db()
    query = "SELECT * FROM transactions WHERE 1=1"
    params = []
    if month and year:
        query += " AND strftime('%m', date) = ? AND strftime('%Y', date) = ?"
        params += [f"{int(month):02d}", str(year)]
    elif year:
        query += " AND strftime('%Y', date) = ?"
        params.append(str(year))
    if type_filter:
        query += " AND type = ?"
        params.append(type_filter)
    query += " ORDER BY date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_transaction(type_, amount, category, description, date):
    conn = get_db()
    conn.execute(
        "INSERT INTO transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)",
        (type_, amount, category, description, date),
    )
    conn.commit()
    conn.close()


def delete_transaction(tid):
    conn = get_db()
    conn.execute("DELETE FROM transactions WHERE id = ?", (tid,))
    conn.commit()
    conn.close()


def get_summary(year=None):
    conn = get_db()
    query_base = "SELECT type, SUM(amount) as total FROM transactions"
    params = []
    if year:
        query_base += " WHERE strftime('%Y', date) = ?"
        params.append(str(year))
    query_base += " GROUP BY type"
    rows = conn.execute(query_base, params).fetchall()
    result = {"income": 0.0, "expense": 0.0}
    for r in rows:
        result[r["type"]] = r["total"] or 0.0

    # Monthly breakdown
    monthly_query = """
        SELECT strftime('%m', date) as month, type, SUM(amount) as total
        FROM transactions
    """
    m_params = []
    if year:
        monthly_query += " WHERE strftime('%Y', date) = ?"
        m_params.append(str(year))
    monthly_query += " GROUP BY month, type ORDER BY month"
    monthly_rows = conn.execute(monthly_query, m_params).fetchall()

    monthly = {}
    for r in monthly_rows:
        m = int(r["month"])
        if m not in monthly:
            monthly[m] = {"income": 0.0, "expense": 0.0}
        monthly[m][r["type"]] = r["total"] or 0.0

    # Category breakdown
    cat_query = """
        SELECT category, type, SUM(amount) as total
        FROM transactions
    """
    c_params = []
    if year:
        cat_query += " WHERE strftime('%Y', date) = ?"
        c_params.append(str(year))
    cat_query += " GROUP BY category, type ORDER BY total DESC"
    cat_rows = conn.execute(cat_query, c_params).fetchall()
    categories = [dict(r) for r in cat_rows]

    conn.close()
    return {
        "income": result["income"],
        "expense": result["expense"],
        "balance": result["income"] - result["expense"],
        "monthly": monthly,
        "categories": categories,
    }


def get_categories(type_filter=None):
    conn = get_db()
    query = "SELECT * FROM categories"
    params = []
    if type_filter:
        query += " WHERE type = ?"
        params.append(type_filter)
    query += " ORDER BY name"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]
