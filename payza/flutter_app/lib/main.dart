import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/api_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/cards_screen.dart';
import 'screens/marketplace_screen.dart';
import 'screens/payment_screen.dart';
import 'screens/profile_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => ApiService(),
      child: const PayzaApp(),
    ),
  );
}

class PayzaApp extends StatelessWidget {
  const PayzaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Payza',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF0D7C5C),
        scaffoldBackgroundColor: const Color(0xFF060E0C),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0D7C5C),
          secondary: Color(0xFF00BFA5),
          surface: Color(0xFF0A1F1A),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          centerTitle: true,
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Color(0xFF0A1F1A),
          selectedItemColor: Color(0xFF00BFA5),
          unselectedItemColor: Colors.white38,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
        ),
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        useMaterial3: true,
      ),
      initialRoute: '/login',
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/login':
            return MaterialPageRoute(builder: (_) => const LoginScreen());
          case '/register':
            return MaterialPageRoute(builder: (_) => const RegisterScreen());
          case '/dashboard':
            return MaterialPageRoute(builder: (_) => const MainShell());
          case '/wallet':
            return MaterialPageRoute(builder: (_) => const MainShell(initialIndex: 1));
          case '/cards':
            return MaterialPageRoute(builder: (_) => const MainShell(initialIndex: 2));
          case '/marketplace':
            return MaterialPageRoute(builder: (_) => const MainShell(initialIndex: 3));
          case '/profile':
            return MaterialPageRoute(builder: (_) => const MainShell(initialIndex: 4));
          case '/payment':
            return MaterialPageRoute(builder: (_) => const PaymentScreen());
          default:
            return MaterialPageRoute(builder: (_) => const LoginScreen());
        }
      },
    );
  }
}

class MainShell extends StatefulWidget {
  final int initialIndex;
  const MainShell({super.key, this.initialIndex = 0});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  late int _currentIndex;

  final _screens = const [
    DashboardScreen(),
    WalletScreen(),
    CardsScreen(),
    MarketplaceScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFF1A2626), width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
            BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet), label: 'Wallet'),
            BottomNavigationBarItem(icon: Icon(Icons.credit_card), label: 'Cards'),
            BottomNavigationBarItem(icon: Icon(Icons.store), label: 'Market'),
            BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
