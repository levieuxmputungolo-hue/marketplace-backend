import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/product_model.dart';
import '../models/card_model.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  List<Product> _products = [];
  List<Product> _filtered = [];
  bool _loading = false;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _searchController.addListener(_filter);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _filter() {
    final q = _searchController.text.toLowerCase();
    setState(() {
      _filtered = _products.where((p) => p.name.toLowerCase().contains(q) || p.description.toLowerCase().contains(q)).toList();
    });
  }

  Future<void> _loadProducts() async {
    setState(() => _loading = true);
    try {
      final products = await context.read<ApiService>().getProducts();
      if (mounted) {
        setState(() {
          _products = products;
          _filter();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  void _showProductDetails(Product product) {
    final api = context.read<ApiService>();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A2626),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return FutureBuilder<List<VirtualCard>>(
          future: api.getCards(),
          builder: (ctx, snap) {
            final cards = snap.data ?? [];
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 20),
                  Text(product.name, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(product.description, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 14)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Text('\$${product.price.toStringAsFixed(2)}', style: const TextStyle(color: Colors.tealAccent, fontSize: 28, fontWeight: FontWeight.bold)),
                      const Spacer(),
                      Text('Stock: ${product.stock}', style: TextStyle(color: Colors.white.withOpacity(0.5))),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (cards.isEmpty)
                    Text('No cards available. Create one first.', style: TextStyle(color: Colors.white.withOpacity(0.4)))
                  else
                    ...cards.map((card) => RadioListTile<int>(
                          value: card.id,
                          groupValue: null,
                          onChanged: (val) async {
                            if (val == null) return;
                            Navigator.pop(ctx);
                            try {
                              await api.buyProduct(product.id, cardId: val);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Purchase successful!'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
                                _loadProducts();
                              }
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
                              }
                            }
                          },
                          title: Text('${card.maskedNumber} - \$${card.balance.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 13)),
                          activeColor: Colors.tealAccent,
                          toggleable: true,
                        )),
                  if (cards.isNotEmpty)
                    const SizedBox(height: 10),
                  if (cards.isNotEmpty)
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: null,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D7C5C), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                        child: const Text('Select a card above to buy', style: TextStyle(color: Colors.white70)),
                      ),
                    ),
                  const SizedBox(height: 10),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showAddProductForm() {
    final nameC = TextEditingController();
    final descC = TextEditingController();
    final priceC = TextEditingController();
    final stockC = TextEditingController();
    final imageC = TextEditingController();
    bool adding = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1A2626),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 20),
                  const Text('Add Product', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  _sheetField(nameC, 'Product Name'),
                  const SizedBox(height: 12),
                  _sheetField(descC, 'Description'),
                  const SizedBox(height: 12),
                  _sheetField(priceC, 'Price', keyboardType: TextInputType.number),
                  const SizedBox(height: 12),
                  _sheetField(stockC, 'Stock', keyboardType: TextInputType.number),
                  const SizedBox(height: 12),
                  _sheetField(imageC, 'Image URL (optional)'),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: adding
                          ? null
                          : () async {
                              final name = nameC.text.trim();
                              final desc = descC.text.trim();
                              final price = double.tryParse(priceC.text);
                              final stock = int.tryParse(stockC.text) ?? 0;
                              if (name.isEmpty || desc.isEmpty || price == null || price <= 0) return;
                              setSheetState(() => adding = true);
                              try {
                                await context.read<ApiService>().createProduct(name: name, description: desc, price: price, stock: stock, imageUrl: imageC.text.isNotEmpty ? imageC.text : null);
                                if (mounted) Navigator.pop(ctx);
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Product listed!'), backgroundColor: Colors.greenAccent, behavior: SnackBarBehavior.floating));
                                  _loadProducts();
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
                                }
                              }
                            },
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D7C5C), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: adding
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('List Product', style: TextStyle(color: Colors.white)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _sheetField(TextEditingController c, String label, {TextInputType? keyboardType}) {
    return TextField(
      controller: c,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
        filled: true,
        fillColor: const Color(0xFF0A1F1A),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
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
                    const Icon(Icons.store, color: Colors.tealAccent, size: 28),
                    const SizedBox(width: 10),
                    const Text('Marketplace', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                    const Spacer(),
                    GestureDetector(
                      onTap: _showAddProductForm,
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: const Color(0xFF1A2626), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.add, color: Colors.tealAccent, size: 20),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Search products...',
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                    prefixIcon: Icon(Icons.search, color: Colors.white.withOpacity(0.4)),
                    filled: true,
                    fillColor: const Color(0xFF1A2626),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colors.tealAccent, width: 1.5)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.tealAccent))
                    : _filtered.isEmpty
                        ? Center(child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.shopping_bag, size: 64, color: Colors.white.withOpacity(0.15)),
                              const SizedBox(height: 12),
                              Text('No products found', style: TextStyle(color: Colors.white.withOpacity(0.3))),
                            ],
                          ))
                        : GridView.builder(
                            padding: const EdgeInsets.all(16),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              childAspectRatio: 0.7,
                              crossAxisSpacing: 14,
                              mainAxisSpacing: 14,
                            ),
                            itemCount: _filtered.length,
                            itemBuilder: (_, i) {
                              final product = _filtered[i];
                              return GestureDetector(
                                onTap: () => _showProductDetails(product),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1A2626),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Container(
                                          width: double.infinity,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF0A1F1A),
                                            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                                          ),
                                          child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                                              ? ClipRRect(
                                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                                                  child: Image.network(product.imageUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.white24, size: 40)),
                                                )
                                              : const Icon(Icons.image, color: Colors.white24, size: 40),
                                        ),
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.all(12),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(product.name, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                                            const SizedBox(height: 4),
                                            Text('\$${product.price.toStringAsFixed(2)}', style: const TextStyle(color: Colors.tealAccent, fontSize: 16, fontWeight: FontWeight.bold)),
                                            const SizedBox(height: 2),
                                            Text('Stock: ${product.stock}', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
