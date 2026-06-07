import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class TransactionTile extends StatelessWidget {
  final String title;
  final String? subtitle;
  final double amount;
  final String type;
  final String status;
  final DateTime date;

  const TransactionTile({
    super.key,
    required this.title,
    this.subtitle,
    required this.amount,
    required this.type,
    required this.status,
    required this.date,
  });

  IconData get _icon {
    switch (type) {
      case 'deposit':
        return Icons.arrow_downward;
      case 'withdraw':
        return Icons.arrow_upward;
      case 'payment':
        return Icons.shopping_cart;
      case 'transfer':
      case 'transfer_out':
        return Icons.swap_horiz;
      case 'receive':
        return Icons.call_received;
      case 'refund':
        return Icons.replay;
      default:
        return Icons.receipt_long;
    }
  }

  Color get _iconColor {
    if (status == 'failed' || status == 'cancelled') return Colors.redAccent;
    final typeLower = type.toLowerCase();
    if (typeLower == 'deposit' || typeLower == 'receive' || typeLower == 'refund') {
      return Colors.greenAccent;
    }
    return Colors.tealAccent;
  }

  Color get _amountColor {
    final typeLower = type.toLowerCase();
    if (typeLower == 'deposit' || typeLower == 'receive' || typeLower == 'refund') {
      return Colors.greenAccent;
    }
    return Colors.white;
  }

  String get _statusText {
    switch (status) {
      case 'completed':
      case 'success':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  }

  Color get _statusColor {
    switch (status) {
      case 'completed':
      case 'success':
        return Colors.greenAccent;
      case 'pending':
        return Colors.orangeAccent;
      case 'failed':
        return Colors.redAccent;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPositive = _amountColor == Colors.greenAccent;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _iconColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(_icon, color: _iconColor, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (subtitle != null) ...[
                      Text(
                        subtitle!,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.4),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(width: 3, height: 3, decoration: BoxDecoration(color: Colors.white.withOpacity(0.3), shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      _statusText,
                      style: TextStyle(
                        color: _statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isPositive ? '+' : ''}\$${amount.toStringAsFixed(2)}',
                style: TextStyle(
                  color: _amountColor,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                DateFormat('MMM dd, HH:mm').format(date),
                style: TextStyle(
                  color: Colors.white.withOpacity(0.35),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
