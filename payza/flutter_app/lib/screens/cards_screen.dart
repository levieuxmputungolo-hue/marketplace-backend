import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/card_model.dart';
import '../widgets/credit_card_widget.dart';

class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});

  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  List<VirtualCard> _cards = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadCards();
  }

  Future<void> _loadCards() async {
    setState(() => _loading = true);
    try {
      final cards = await context.read<ApiService>().getCards();
      if (mounted) setState(() => _cards = cards);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _createCard() async {
    setState(() => _loading = true);
    try {
      final card = await context.read<ApiService>().createCard();
      if (mounted) {
        setState(() => _cards.add(card));
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Card created successfully'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _toggleBlock(VirtualCard card) async {
    try {
      final api = context.read<ApiService>();
      VirtualCard updated;
      if (card.isActive) {
        updated = await api.blockCard(card.id);
      } else {
        updated = await api.unblockCard(card.id);
      }
      if (mounted) {
        setState(() {
          final idx = _cards.indexWhere((c) => c.id == card.id);
          if (idx >= 0) _cards[idx] = updated;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
  }

  void _showCardDetails(VirtualCard card) {
    final limitController = TextEditingController(text: card.dailyLimit.toStringAsFixed(0));
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A2626),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 20),
              const Text('Card Details', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              _detailRow('Card Number', card.cardNumber),
              _detailRow('Expiry', card.expiry),
              _detailRow('CVV', card.cvv),
              _detailRow('Balance', '\$${card.balance.toStringAsFixed(2)}'),
              _detailRow('Status', card.isActive ? 'Active' : 'Blocked'),
              const SizedBox(height: 20),
              const Text('Daily Limit', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: limitController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFF0A1F1A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    final limit = double.tryParse(limitController.text);
                    if (limit != null && limit > 0) {
                      try {
                        final updated = await context.read<ApiService>().setCardLimit(card.id, limit);
                        if (mounted) {
                          setState(() {
                            final idx = _cards.indexWhere((c) => c.id == card.id);
                            if (idx >= 0) _cards[idx] = updated;
                          });
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Limit updated'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
                        }
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D7C5C), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  child: const Text('Update Limit', style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    _toggleBlock(card);
                    Navigator.pop(ctx);
                  },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: card.isActive ? Colors.redAccent : Colors.greenAccent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(card.isActive ? 'Block Card' : 'Unblock Card', style: TextStyle(color: card.isActive ? Colors.redAccent : Colors.greenAccent)),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0A1F1A), Color(0xFF060E0C), Color(0xFF000000)]),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Row(
                  children: [
                    const Icon(Icons.credit_card, color: Colors.tealAccent, size: 28),
                    const SizedBox(width: 10),
                    const Text('My Cards', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                    const Spacer(),
                    GestureDetector(
                      onTap: _loadCards,
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: const Color(0xFF1A2626), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.refresh, color: Colors.tealAccent, size: 20),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _loading && _cards.isEmpty
                    ? const Center(child: CircularProgressIndicator(color: Colors.tealAccent))
                    : _cards.isEmpty
                        ? Center(child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.credit_card_off, size: 64, color: Colors.white.withOpacity(0.15)),
                              const SizedBox(height: 12),
                              Text('No cards yet', style: TextStyle(color: Colors.white.withOpacity(0.3))),
                            ],
                          ))
                        : ListView.builder(
                            padding: const EdgeInsets.all(20),
                            itemCount: _cards.length,
                            itemBuilder: (_, i) {
                              final card = _cards[i];
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child: CreditCardWidget(
                                  cardNumber: card.cardNumber,
                                  expiry: card.expiry,
                                  cvv: card.cvv,
                                  cardholderName: context.read<ApiService>().currentUser?.name ?? 'User',
                                  status: card.status,
                                  balance: card.balance,
                                  dailyLimit: card.dailyLimit,
                                  onTap: () => _showCardDetails(card),
                                ),
                              );
                            },
                          ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton.icon(
                    onPressed: _loading ? null : _createCard,
                    icon: const Icon(Icons.add),
                    label: const Text('Create New Card', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D7C5C),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
