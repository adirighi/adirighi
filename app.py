from flask import Flask, render_template, request, jsonify
from datetime import datetime
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


if __name__ == "__main__":
    app.run(debug=True, port=5000)
