class VirtualCard {
  final int id;
  final String cardNumber;
  final String expiry;
  final String cvv;
  final String status;
  final double balance;
  final double dailyLimit;

  VirtualCard({
    required this.id,
    required this.cardNumber,
    required this.expiry,
    required this.cvv,
    required this.status,
    required this.balance,
    required this.dailyLimit,
  });

  factory VirtualCard.fromJson(Map<String, dynamic> json) {
    return VirtualCard(
      id: json['id'] as int,
      cardNumber: json['card_number'] as String? ?? json['cardNumber'] as String? ?? '',
      expiry: json['expiry'] as String? ?? '',
      cvv: json['cvv'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      dailyLimit: (json['daily_limit'] as num?)?.toDouble() ?? json['dailyLimit'] as double? ?? 1000.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'card_number': cardNumber,
      'expiry': expiry,
      'cvv': cvv,
      'status': status,
      'balance': balance,
      'daily_limit': dailyLimit,
    };
  }

  String get maskedNumber {
    if (cardNumber.length >= 4) {
      return '**** **** **** ${cardNumber.substring(cardNumber.length - 4)}';
    }
    return cardNumber;
  }

  bool get isActive => status == 'active';
}
