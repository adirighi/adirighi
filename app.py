import csv
import io
from datetime import datetime

from flask import Flask, Response, render_template, request, jsonify
import database as db

app = Flask(__name__)


@app.before_request
def setup():
    db.init_db()


@app.route("/")
def index():
    current_year = datetime.now().year
    years = list(range(current_year - 4, current_year + 1))
    return render_template("index.html", current_year=current_year, years=years)


@app.route("/api/transactions")
def api_transactions():
    month = request.args.get("month")
    year = request.args.get("year")
    type_filter = request.args.get("type")
    transactions = db.get_transactions(month=month, year=year, type_filter=type_filter)
    return jsonify(transactions)


@app.route("/api/transactions", methods=["POST"])
def api_add_transaction():
    data = request.json
    required = ["type", "amount", "category", "date"]
    if not all(k in data for k in required):
        return jsonify({"error": "Fehlende Felder"}), 400
    if data["type"] not in ("income", "expense"):
        return jsonify({"error": "Ungültiger Typ"}), 400
    try:
        amount = float(data["amount"])
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Ungültiger Betrag"}), 400

    db.add_transaction(
        type_=data["type"],
        amount=amount,
        category=data["category"],
        description=data.get("description", ""),
        date=data["date"],
    )
    return jsonify({"status": "ok"}), 201


@app.route("/api/transactions/export")
def api_export_csv():
    year = request.args.get("year")
    month = request.args.get("month")
    type_filter = request.args.get("type")
    transactions = db.get_transactions(month=month, year=year, type_filter=type_filter)
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Datum", "Typ", "Kategorie", "Beschreibung", "Betrag"])
    for t in transactions:
        typ_label = "Einnahme" if t["type"] == "income" else "Ausgabe"
        writer.writerow([
            t["date"], typ_label, t["category"],
            t["description"] or "",
            str(t["amount"]).replace(".", ","),
        ])
    filename = f"transaktionen_{year or 'alle'}.csv"
    return Response(
        "﻿" + output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.route("/api/transactions/<int:tid>", methods=["PUT"])
def api_update_transaction(tid):
    data = request.json
    if not all(k in data for k in ["type", "amount", "category", "date"]):
        return jsonify({"error": "Fehlende Felder"}), 400
    if data["type"] not in ("income", "expense"):
        return jsonify({"error": "Ungültiger Typ"}), 400
    try:
        amount = float(data["amount"])
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Ungültiger Betrag"}), 400
    db.update_transaction(
        tid, data["type"], amount, data["category"],
        data.get("description", ""), data["date"],
    )
    return jsonify({"status": "ok"})


@app.route("/api/transactions/<int:tid>", methods=["DELETE"])
def api_delete_transaction(tid):
    db.delete_transaction(tid)
    return jsonify({"status": "ok"})


@app.route("/api/summary")
def api_summary():
    year = request.args.get("year")
    summary = db.get_summary(year=year)
    return jsonify(summary)


@app.route("/api/categories")
def api_categories():
    type_filter = request.args.get("type")
    categories = db.get_categories(type_filter=type_filter)
    return jsonify(categories)


@app.route("/api/categories", methods=["POST"])
def api_add_category():
    data = request.json
    if not data or not data.get("name") or not data.get("type"):
        return jsonify({"error": "Name und Typ erforderlich"}), 400
    if data["type"] not in ("income", "expense"):
        return jsonify({"error": "Ungültiger Typ"}), 400
    name = data["name"].strip()
    if not name:
        return jsonify({"error": "Name darf nicht leer sein"}), 400
    ok = db.add_category(name, data["type"])
    if not ok:
        return jsonify({"error": "Kategorie existiert bereits"}), 409
    return jsonify({"status": "ok"}), 201


@app.route("/api/categories/<int:cid>", methods=["DELETE"])
def api_delete_category(cid):
    result = db.delete_category(cid)
    if result == "not_found":
        return jsonify({"error": "Nicht gefunden"}), 404
    if result == "in_use":
        return jsonify({"error": "Kategorie wird von Transaktionen verwendet"}), 409
    return jsonify({"status": "ok"})


@app.route("/api/budgets")
def api_get_budgets():
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    if not month or not year:
        return jsonify({"error": "month und year erforderlich"}), 400
    budgets = db.get_budgets(month, year)
    tx = db.get_transactions(month=str(month), year=str(year), type_filter="expense")
    actuals = {}
    for t in tx:
        actuals[t["category"]] = actuals.get(t["category"], 0.0) + t["amount"]
    result = [{**b, "actual": round(actuals.get(b["category"], 0.0), 2)} for b in budgets]
    return jsonify(result)


@app.route("/api/budgets", methods=["POST"])
def api_set_budget():
    data = request.json
    required = ["category", "month", "year", "limit_amount"]
    if not all(k in data for k in required):
        return jsonify({"error": "Fehlende Felder"}), 400
    try:
        month = int(data["month"])
        year = int(data["year"])
        limit = float(data["limit_amount"])
        if not (1 <= month <= 12) or year < 2000 or limit <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Ungültige Werte"}), 400
    db.set_budget(data["category"], month, year, limit)
    return jsonify({"status": "ok"}), 201


if __name__ == "__main__":
    app.run(debug=True, port=5000)
