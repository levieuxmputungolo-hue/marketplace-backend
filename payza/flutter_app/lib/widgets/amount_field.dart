import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class AmountField extends StatelessWidget {
  final TextEditingController controller;
  final String? label;
  final String? hint;
  final String currencySymbol;

  const AmountField({
    super.key,
    required this.controller,
    this.label,
    this.hint,
    this.currencySymbol = '\$',
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
      ],
      style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
      decoration: InputDecoration(
        labelText: label ?? 'Amount',
        hintText: hint ?? '0.00',
        hintStyle: TextStyle(color: Colors.white.withOpacity(0.2)),
        prefixText: '$currencySymbol ',
        prefixStyle: const TextStyle(color: Colors.tealAccent, fontSize: 24, fontWeight: FontWeight.bold),
        filled: true,
        fillColor: const Color(0xFF1E2A2A),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.tealAccent, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
      ),
    );
  }
}
