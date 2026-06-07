class User {
  final String id;
  final String phone;
  final String email;
  final String name;
  final String? fullName;
  final String? dateOfBirth;
  final double balance;

  User({
    required this.id,
    required this.phone,
    required this.email,
    required this.name,
    this.fullName,
    this.dateOfBirth,
    required this.balance,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String? ?? json['id'].toString(),
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      name: json['name'] as String? ?? '',
      fullName: json['full_name'] as String?,
      dateOfBirth: json['date_of_birth'] as String?,
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'email': email,
      'name': name,
      'full_name': fullName,
      'date_of_birth': dateOfBirth,
      'balance': balance,
    };
  }
}
