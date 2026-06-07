import 'package:flutter/material.dart';
import 'dart:math';

class CreditCardWidget extends StatelessWidget {
  final String cardNumber;
  final String expiry;
  final String cvv;
  final String cardholderName;
  final String status;
  final double balance;
  final double dailyLimit;
  final VoidCallback? onTap;

  const CreditCardWidget({
    super.key,
    required this.cardNumber,
    required this.expiry,
    required this.cvv,
    required this.cardholderName,
    this.status = 'active',
    this.balance = 0.0,
    this.dailyLimit = 1000.0,
    this.onTap,
  });

  String get _maskedNumber {
    final cleaned = cardNumber.replaceAll(' ', '');
    if (cleaned.length >= 4) {
      final last4 = cleaned.substring(cleaned.length - 4);
      return '**** **** **** $last4';
    }
    return cardNumber;
  }

  @override
  Widget build(BuildContext context) {
    final isActive = status == 'active';
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 200,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isActive
                ? [const Color(0xFF0D7C5C), const Color(0xFF0A4D3B), const Color(0xFF062B20)]
                : [Colors.grey.shade800, Colors.grey.shade900, Colors.black],
          ),
          boxShadow: [
            BoxShadow(
              color: (isActive ? const Color(0xFF0D7C5C) : Colors.grey).withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned(
              top: -30,
              right: -30,
              child: Transform.rotate(
                angle: pi / 4,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    color: Colors.white.withOpacity(0.05),
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -20,
              left: -20,
              child: Transform.rotate(
                angle: pi / 6,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    color: Colors.white.withOpacity(0.03),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isActive ? 'ACTIVE' : 'BLOCKED',
                        style: TextStyle(
                          color: isActive ? Colors.greenAccent : Colors.redAccent,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                      Row(
                        children: [
                          Container(
                            width: 30,
                            height: 20,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: Colors.white.withOpacity(0.2),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            width: 30,
                            height: 20,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Colors.white.withOpacity(0.3)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    _maskedNumber,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      letterSpacing: 3,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'EXPIRES',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.5),
                              fontSize: 9,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            expiry,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 24),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'CVV',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.5),
                              fontSize: 9,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            cvv,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'BALANCE',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.5),
                              fontSize: 9,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '\$${balance.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    cardholderName.toUpperCase(),
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 13,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
