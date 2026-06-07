class Transaction {
  final int id;
  final int? fromId;
  final int? toId;
  final int? cardId;
  final double amount;
  final String type;
  final String status;
  final String? description;
  final String? reference;
  final DateTime createdAt;

  Transaction({
    required this.id,
    this.fromId,
    this.toId,
    this.cardId,
    required this.amount,
    required this.type,
    required this.status,
    this.description,
    this.reference,
    required this.createdAt,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as int,
      fromId: json['from_id'] as int? ?? json['fromId'] as int?,
      toId: json['to_id'] as int? ?? json['toId'] as int?,
      cardId: json['card_id'] as int? ?? json['cardId'] as int?,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      type: json['type'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      description: json['description'] as String?,
      reference: json['reference'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'from_id': fromId,
      'to_id': toId,
      'card_id': cardId,
      'amount': amount,
      'type': type,
      'status': status,
      'description': description,
      'reference': reference,
      'created_at': createdAt.toIso8601String(),
    };
  }

  bool get isCredit => type == 'deposit' || type == 'receive' || type == 'refund';
  bool get isDebit => type == 'withdraw' || type == 'payment' || type == 'transfer_out';
}
