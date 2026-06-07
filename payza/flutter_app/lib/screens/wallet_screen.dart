import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/transaction_model.dart';
import '../widgets/transaction_tile.dart';
import '../widgets/amount_field.dart';
import 'package:intl/intl.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _depositController = TextEditingController();
  final _withdrawController = TextEditingController();
  final _transferPhoneController = TextEditingController();
  final _transferAmountController = TextEditingController();
  bool _loading = false;
  List<Transaction> _transactions = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadHistory();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _depositController.dispose();
    _withdrawController.dispose();
    _transferPhoneController.dispose();
    _transferAmountController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    try {
      final api = context.read<ApiService>();
      await api.getBalance();
      final history = await api.getPaymentHistory();
      if (mounted) setState(() => _transactions = history);
    } catch (_) {}
  }

  Future<void> _deposit() async {
    final amount = double.tryParse(_depositController.text);
    if (amount == null || amount <= 0) return;
    setState(() => _loading = true);
    try {
      await context.read<ApiService>().deposit(amount);
      _depositController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deposit successful'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
      }
      await _loadHistory();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _withdraw() async {
    final amount = double.tryParse(_withdrawController.text);
    if (amount == null || amount <= 0) return;
    setState(() => _loading = true);
    try {
      await context.read<ApiService>().withdraw(amount);
      _withdrawController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Withdrawal successful'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
      }
      await _loadHistory();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _transfer() async {
    final amount = double.tryParse(_transferAmountController.text);
    final phone = _transferPhoneController.text.trim();
    if (amount == null || amount <= 0) return;
    if (phone.isEmpty) return;
    setState(() => _loading = true);
    try {
      await context.read<ApiService>().transfer(phone, amount);
      _transferPhoneController.clear();
      _transferAmountController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer successful'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
      }
      await _loadHistory();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiService>();
    final balance = api.currentUser?.balance ?? 0.0;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0A1F1A), Color(0xFF060E0C), Color(0xFF000000)]),
        ),
        child: SafeArea(
          child: NestedScrollView(
            headerSliverBuilder: (context, inner) => [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.account_balance_wallet, color: Colors.tealAccent, size: 28),
                          const SizedBox(width: 10),
                          const Text('Wallet', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                          const Spacer(),
                          GestureDetector(
                            onTap: _loadHistory,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(color: const Color(0xFF1A2626), borderRadius: BorderRadius.circular(12)),
                              child: const Icon(Icons.refresh, color: Colors.tealAccent, size: 20),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0D7C5C), Color(0xFF0A4D3B)]),
                          boxShadow: [BoxShadow(color: const Color(0xFF0D7C5C).withOpacity(0.3), blurRadius: 30, offset: const Offset(0, 10))],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Available Balance', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13)),
                            const SizedBox(height: 6),
                            Text('\$${NumberFormat('#,##0.00').format(balance)}',
                                style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPersistentHeader(
                pinned: true,
                delegate: _TabHeaderDelegate(
                  child: Container(
                    color: const Color(0xFF060E0C),
                    child: TabBar(
                      controller: _tabController,
                      indicatorColor: Colors.tealAccent,
                      labelColor: Colors.tealAccent,
                      unselectedLabelColor: Colors.white54,
                      tabs: const [
                        Tab(text: 'Deposit'),
                        Tab(text: 'Withdraw'),
                        Tab(text: 'Transfer'),
                        Tab(text: 'History'),
                      ],
                    ),
                  ),
                ),
              ),
            ],
            body: Container(
              color: const Color(0xFF060E0C),
              child: TabBarView(
                controller: _tabController,
                children: [
                  _depositTab(), _withdrawTab(), _transferTab(), _historyTab(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _depositTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          AmountField(controller: _depositController, label: 'Deposit Amount', hint: 'Enter amount to deposit'),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: _loading ? null : _deposit,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D7C5C), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
              child: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Deposit Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _withdrawTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          AmountField(controller: _withdrawController, label: 'Withdraw Amount', hint: 'Enter amount to withdraw'),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: _loading ? null : _withdraw,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7D3C98), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
              child: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Withdraw', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _transferTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          TextField(
            controller: _transferPhoneController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'Recipient Phone',
              labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
              prefixIcon: const Icon(Icons.phone, color: Colors.white54),
              filled: true,
              fillColor: const Color(0xFF1E2A2A),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colors.tealAccent, width: 1.5)),
            ),
          ),
          const SizedBox(height: 16),
          AmountField(controller: _transferAmountController, label: 'Transfer Amount', hint: 'Enter amount'),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: _loading ? null : _transfer,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1A5276), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
              child: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Send Money', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _historyTab() {
    if (_transactions.isEmpty) {
      return Center(child: Text('No transactions yet', style: TextStyle(color: Colors.white.withOpacity(0.3))));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: _transactions.length,
      itemBuilder: (_, i) {
        final t = _transactions[i];
        return TransactionTile(
          title: t.description ?? t.type,
          subtitle: t.reference,
          amount: t.amount,
          type: t.type,
          status: t.status,
          date: t.createdAt,
        );
      },
    );
  }
}

class _TabHeaderDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  _TabHeaderDelegate({required this.child});

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => child;

  @override
  double get maxExtent => 48;

  @override
  double get minExtent => 48;

  @override
  bool shouldRebuild(_TabHeaderDelegate old) => false;
}
