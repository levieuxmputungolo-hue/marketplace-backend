import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api.dart';
import '../models/user.dart';
import '../models/card_model.dart';
import '../models/transaction_model.dart';
import '../models/product_model.dart';

class ApiService extends ChangeNotifier {
  static const _tokenKey = 'jwt_token';
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  User? _currentUser;
  String? _token;

  User? get currentUser => _currentUser;
  String? get token => _token;
  bool get isLoggedIn => _token != null;

  Future<String?> _getToken() async {
    if (_token != null) return _token;
    try {
      _token = await _secureStorage.read(key: _tokenKey);
    } catch (_) {
      _token = null;
    }
    if (_token == null) {
      try {
        final prefs = await SharedPreferences.getInstance();
        _token = prefs.getString(_tokenKey);
      } catch (_) {
        _token = null;
      }
    }
    return _token;
  }

  Future<void> _saveToken(String token) async {
    _token = token;
    try {
      await _secureStorage.write(key: _tokenKey, value: token);
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
    }
  }

  Future<void> _removeToken() async {
    _token = null;
    try {
      await _secureStorage.delete(key: _tokenKey);
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
    } catch (_) {}
  }

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth) {
      final t = await _getToken();
      if (t != null) headers['Authorization'] = 'Bearer $t';
    }
    return headers;
  }

  String _errorMessage(dynamic e, [http.Response? res]) {
    if (res != null) {
      try {
        final body = jsonDecode(res.body);
        if (body is Map && body.containsKey('detail')) {
          return body['detail'].toString();
        }
      } catch (_) {}
      return 'Error ${res.statusCode}: ${res.reasonPhrase ?? 'Unknown error'}';
    }
    if (e is http.ClientException) return 'Connection error: ${e.message}';
    return 'An unexpected error occurred';
  }

  Future<User> login({String? phone, String? email, required String password}) async {
    try {
      final body = <String, String>{'password': password};
      if (phone != null && phone.isNotEmpty) {
        body['phone'] = phone;
      } else if (email != null && email.isNotEmpty) {
        body['email'] = email;
      }
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/auth/login'),
        headers: await _headers(auth: false),
        body: jsonEncode(body),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final token = data['access_token'] as String? ?? data['token'] as String? ?? '';
        if (token.isNotEmpty) await _saveToken(token);
        _currentUser = User.fromJson(data['user'] as Map<String, dynamic>? ?? data);
        notifyListeners();
        return _currentUser!;
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<User> register({required String name, required String phone, required String email, required String password, String? fullName, String? dateOfBirth}) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/auth/register'),
        headers: await _headers(auth: false),
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'email': email,
          'full_name': fullName,
          'date_of_birth': dateOfBirth,
          'password': password,
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body);
        final token = data['access_token'] as String? ?? data['token'] as String? ?? '';
        if (token.isNotEmpty) await _saveToken(token);
        _currentUser = User.fromJson(data['user'] as Map<String, dynamic>? ?? data);
        notifyListeners();
        return _currentUser!;
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<User> getWallet() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/wallet'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        _currentUser = User.fromJson(data is Map<String, dynamic> ? data : {});
        notifyListeners();
        return _currentUser!;
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<double> getBalance() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/wallet/balance'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final balance = (data['balance'] as num?)?.toDouble() ?? 0.0;
        if (_currentUser != null) {
          _currentUser = User(
            id: _currentUser!.id,
            phone: _currentUser!.phone,
            email: _currentUser!.email,
            name: _currentUser!.name,
            fullName: _currentUser!.fullName,
            dateOfBirth: _currentUser!.dateOfBirth,
            balance: balance,
          );
          notifyListeners();
        }
        return balance;
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<VirtualCard> createCard() async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/cards'),
        headers: await _headers(),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body);
        return VirtualCard.fromJson(data);
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<List<VirtualCard>> getCards() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/cards'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = data is List ? data : (data['cards'] as List? ?? []);
        return list.map((e) => VirtualCard.fromJson(e as Map<String, dynamic>)).toList();
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<VirtualCard> blockCard(int cardId) async {
    try {
      final res = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/cards/$cardId/block'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        return VirtualCard.fromJson(jsonDecode(res.body));
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<VirtualCard> unblockCard(int cardId) async {
    try {
      final res = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/cards/$cardId/unblock'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        return VirtualCard.fromJson(jsonDecode(res.body));
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<VirtualCard> setCardLimit(int cardId, double limit) async {
    try {
      final res = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/cards/$cardId/limit'),
        headers: await _headers(),
        body: jsonEncode({'daily_limit': limit}),
      );
      if (res.statusCode == 200) {
        return VirtualCard.fromJson(jsonDecode(res.body));
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<Transaction> makePayment({
    required int cardId,
    required double amount,
    int? merchantId,
    String? description,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/payments'),
        headers: await _headers(),
        body: jsonEncode({
          'card_id': cardId,
          'amount': amount,
          'merchant_id': merchantId,
          'description': description,
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        return Transaction.fromJson(jsonDecode(res.body));
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<List<Transaction>> getPaymentHistory() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/payments/history'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = data is List ? data : (data['transactions'] as List? ?? []);
        return list.map((e) => Transaction.fromJson(e as Map<String, dynamic>)).toList();
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<List<Product>> getProducts() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/marketplace/products'),
        headers: await _headers(auth: false),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = data is List ? data : (data['products'] as List? ?? []);
        return list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<Product> createProduct({
    required String name,
    required String description,
    required double price,
    required int stock,
    String? imageUrl,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/marketplace/products'),
        headers: await _headers(),
        body: jsonEncode({
          'name': name,
          'description': description,
          'price': price,
          'stock': stock,
          'image_url': imageUrl,
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        return Product.fromJson(jsonDecode(res.body));
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<Transaction> buyProduct(int productId, {required int cardId, int? quantity}) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/marketplace/products/$productId/buy'),
        headers: await _headers(),
        body: jsonEncode({
          'card_id': cardId,
          'quantity': quantity ?? 1,
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        return Transaction.fromJson(jsonDecode(res.body));
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<Transaction> deposit(double amount) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/wallet/deposit'),
        headers: await _headers(),
        body: jsonEncode({'amount': amount}),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body);
        if (_currentUser != null && data['balance'] != null) {
          _currentUser = User(
            id: _currentUser!.id,
            phone: _currentUser!.phone,
            email: _currentUser!.email,
            name: _currentUser!.name,
            fullName: _currentUser!.fullName,
            dateOfBirth: _currentUser!.dateOfBirth,
            balance: (data['balance'] as num).toDouble(),
          );
          notifyListeners();
        }
        return Transaction.fromJson(data);
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<Transaction> withdraw(double amount) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/wallet/withdraw'),
        headers: await _headers(),
        body: jsonEncode({'amount': amount}),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body);
        if (_currentUser != null && data['balance'] != null) {
          _currentUser = User(
            id: _currentUser!.id,
            phone: _currentUser!.phone,
            email: _currentUser!.email,
            name: _currentUser!.name,
            fullName: _currentUser!.fullName,
            dateOfBirth: _currentUser!.dateOfBirth,
            balance: (data['balance'] as num).toDouble(),
          );
          notifyListeners();
        }
        return Transaction.fromJson(data);
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<Transaction> transfer(String recipientPhone, double amount) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/wallet/transfer'),
        headers: await _headers(),
        body: jsonEncode({
          'recipient_phone': recipientPhone,
          'amount': amount,
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body);
        if (_currentUser != null && data['balance'] != null) {
          _currentUser = User(
            id: _currentUser!.id,
            phone: _currentUser!.phone,
            email: _currentUser!.email,
            name: _currentUser!.name,
            fullName: _currentUser!.fullName,
            dateOfBirth: _currentUser!.dateOfBirth,
            balance: (data['balance'] as num).toDouble(),
          );
          notifyListeners();
        }
        return Transaction.fromJson(data);
      }
      throw Exception(_errorMessage(null, res));
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(_errorMessage(e));
    }
  }

  Future<void> logout() async {
    await _removeToken();
    _currentUser = null;
    notifyListeners();
  }
}
