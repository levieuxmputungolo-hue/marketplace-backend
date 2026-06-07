import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/card_model.dart';
import '../widgets/amount_field.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _merchantController = TextEditingController();
  final _amountController = TextEditingController();
  final _pinController = TextEditingController();
  VirtualCard? _selectedCard;
  List<VirtualCard> _cards = [];
  bool _loading = false;
  bool _showPin = false;

  @override
  void initState() {
    super.initState();
    _loadCards();
  }

  @override
  void dispose() {
    _merchantController.dispose();
    _amountController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _loadCards() async {
    try {
      final cards = await context.read<ApiService>().getCards();
      if (mounted) setState(() => _cards = cards.where((c) => c.isActive).toList());
    } catch (_) {}
  }

  Future<void> _pay() async {
    final amount = double.tryParse(_amountController.text);
    final merchantId = int.tryParse(_merchantController.text);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid amount'), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      return;
    }
    if (_selectedCard == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select a card'), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      return;
    }

    if (!_showPin) {
      setState(() => _showPin = true);
      return;
    }

    if (_pinController.text.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter PIN'), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      return;
    }

    setState(() => _loading = true);
    try {
      await context.read<ApiService>().makePayment(
        cardId: _selectedCard!.id,
        amount: amount,
        merchantId: merchantId,
        description: 'Payment to merchant $merchantId',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment successful!'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
        _amountController.clear();
        _merchantController.clear();
        _pinController.clear();
        setState(() {
          _selectedCard = null;
          _showPin = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0A1F1A), Color(0xFF060E0C), Color(0xFF000000)]),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.payments, color: Colors.tealAccent, size: 28),
                    const SizedBox(width: 10),
                    const Text('Make Payment', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 32),
                TextField(
                  controller: _merchantController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'Merchant ID',
                    hintText: 'Enter merchant ID',
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.2)),
                    labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                    prefixIcon: Icon(Icons.business, color: Colors.white.withOpacity(0.4)),
                    filled: true,
                    fillColor: const Color(0xFF1E2A2A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colors.tealAccent, width: 1.5)),
                  ),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 16),
                AmountField(controller: _amountController, label: 'Payment Amount', hint: '0.00'),
                const SizedBox(height: 20),
                const Text('Select Card', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 10),
                _cards.isEmpty
                    ? Container(
                        padding: const EdgeInsets.all(20),
                        alignment: Alignment.center,
                        child: Text('No active cards. Create one in Cards tab.', style: TextStyle(color: Colors.white.withOpacity(0.3))),
                      )
                    : Column(
                        children: _cards.map((card) {
                          final selected = _selectedCard?.id == card.id;
                          return GestureDetector(
                            onTap: () => setState(() => _selectedCard = card),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: selected ? const Color(0xFF0D7C5C).withOpacity(0.2) : const Color(0xFF1A2626),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: selected ? Colors.tealAccent : Colors.transparent, width: 1.5),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.credit_card, color: selected ? Colors.tealAccent : Colors.white54, size: 24),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(card.maskedNumber, style: TextStyle(color: selected ? Colors.white : Colors.white70, fontWeight: FontWeight.w500)),
                                        Text('\$${card.balance.toStringAsFixed(2)} available', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
                                      ],
                                    ),
                                  ),
                                  if (selected) const Icon(Icons.check_circle, color: Colors.tealAccent, size: 22),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                const SizedBox(height: 24),
                if (_showPin) ...[
                  TextField(
                    controller: _pinController,
                    obscureText: true,
                    maxLength: 4,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white, fontSize: 24, letterSpacing: 8),
                    textAlign: TextAlign.center,
                    decoration: InputDecoration(
                      labelText: 'Enter PIN',
                      labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                      filled: true,
                      fillColor: const Color(0xFF1E2A2A),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colors.tealAccent, width: 1.5)),
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _pay,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D7C5C),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: _loading
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_showPin ? 'Confirm Payment' : 'Continue', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
