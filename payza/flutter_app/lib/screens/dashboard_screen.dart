import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/transaction_model.dart';
import '../widgets/transaction_tile.dart';
import 'package:intl/intl.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Transaction> _recentTransactions = [];
  bool _loadingBalance = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loadingBalance = true);
    try {
      final api = context.read<ApiService>();
      await api.getBalance();
      final history = await api.getPaymentHistory();
      if (mounted) {
        setState(() {
          _recentTransactions = history.take(5).toList();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingBalance = false);
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiService>();
    final user = api.currentUser;
    final balance = user?.balance ?? 0.0;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0A1F1A), Color(0xFF060E0C), Color(0xFF000000)],
          ),
        ),
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _loadData,
            color: Colors.tealAccent,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Welcome back,', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14)),
                          Text(user?.name ?? 'User', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF1A2626),
                          border: Border.all(color: Colors.tealAccent.withOpacity(0.3)),
                        ),
                        child: const Icon(Icons.person, color: Colors.tealAccent, size: 24),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF0D7C5C), Color(0xFF0A4D3B)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0D7C5C).withOpacity(0.3),
                          blurRadius: 30,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Total Balance', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Text('\$${NumberFormat('#,##0.00').format(balance)}',
                                style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold)),
                            if (_loadingBalance)
                              const Padding(
                                padding: EdgeInsets.only(left: 12),
                                child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70)),
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            _balanceActionChip(Icons.add, 'Deposit', () => Navigator.pushNamed(context, '/wallet')),
                            const SizedBox(width: 10),
                            _balanceActionChip(Icons.arrow_upward, 'Send', () => Navigator.pushNamed(context, '/wallet')),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  const Text('Quick Actions', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _quickAction(Icons.account_balance_wallet, 'Wallet', const Color(0xFF0D7C5C), () => Navigator.pushNamed(context, '/wallet')),
                      const Spacer(),
                      _quickAction(Icons.credit_card, 'Cards', const Color(0xFF1A5276), () => Navigator.pushNamed(context, '/cards')),
                      const Spacer(),
                      _quickAction(Icons.payments, 'Pay', const Color(0xFF7D3C98), () => Navigator.pushNamed(context, '/payment')),
                      const Spacer(),
                      _quickAction(Icons.store, 'Market', const Color(0xFFD35400), () => Navigator.pushNamed(context, '/marketplace')),
                    ],
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Recent Transactions', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                      TextButton(
                        onPressed: () => Navigator.pushNamed(context, '/wallet'),
                        child: const Text('See All', style: TextStyle(color: Colors.tealAccent)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_recentTransactions.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(32),
                      alignment: Alignment.center,
                      child: Text('No transactions yet', style: TextStyle(color: Colors.white.withOpacity(0.3))),
                    )
                  else
                    ...List.generate(_recentTransactions.length, (i) {
                      final t = _recentTransactions[i];
                      return TransactionTile(
                        title: t.description ?? t.type,
                        subtitle: t.reference,
                        amount: t.amount,
                        type: t.type,
                        status: t.status,
                        date: t.createdAt,
                      );
                    }),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _balanceActionChip(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: Colors.white.withOpacity(0.12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 16),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(color: Colors.white, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  Widget _quickAction(IconData icon, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 72,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF1A2626),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(color: color.withOpacity(0.3), borderRadius: BorderRadius.circular(14)),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 8),
            Text(label, style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}
