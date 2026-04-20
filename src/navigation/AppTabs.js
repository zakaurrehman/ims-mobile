import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabBar from '../components/ui/TabBar';

// Bottom tab screens
import DashboardScreen from '../screens/app/DashboardScreen';
import ContractsScreen from '../screens/app/ContractsScreen';
import InvoicesScreen from '../screens/app/InvoicesScreen';
import ExpensesScreen from '../screens/app/ExpensesScreen';
import MoreScreen from '../screens/app/MoreScreen';

// Stack screens (accessible from More menu)
import AccountingScreen from '../screens/app/AccountingScreen';
import CashflowScreen from '../screens/app/CashflowScreen';
import StocksScreen from '../screens/app/StocksScreen';
import AccountStatementScreen from '../screens/app/AccountStatementScreen';
import CompanyExpensesScreen from '../screens/app/CompanyExpensesScreen';
import ContractsReviewScreen from '../screens/app/ContractsReviewScreen';
import ContractsStatementScreen from '../screens/app/ContractsStatementScreen';
import InvoicesReviewScreen from '../screens/app/InvoicesReviewScreen';
import InvoicesStatementScreen from '../screens/app/InvoicesStatementScreen';
import MarginsScreen from '../screens/app/MarginsScreen';
import MaterialTablesScreen from '../screens/app/MaterialTablesScreen';
import SettingsScreen from '../screens/app/SettingsScreen';
import SpecialInvoicesScreen from '../screens/app/SpecialInvoicesScreen';
import AnalysisScreen from '../screens/app/AnalysisScreen';
import AssistantScreen from '../screens/app/AssistantScreen';
import FormulasScreen from '../screens/app/FormulasScreen';
import SharonAdminScreen from '../screens/app/SharonAdminScreen';
import ShipmentScreen from '../screens/app/ShipmentScreen';
import SupplierManagementScreen from '../screens/app/SupplierManagementScreen';
import ClientManagementScreen from '../screens/app/ClientManagementScreen';
import CompanyDetailsScreen from '../screens/app/settings/CompanyDetailsScreen';
import BankAccountsScreen from '../screens/app/settings/BankAccountsScreen';
import StocksConfigScreen from '../screens/app/settings/StocksConfigScreen';
import UsersScreen from '../screens/app/settings/UsersScreen';
import InventoryReviewScreen from '../screens/app/InventoryReviewScreen';
import SetupScreen from '../screens/app/settings/SetupScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

import { colors } from '../theme/colors';

const darkScreen = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bg0 },
  animation: 'slide_from_right',
};

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Contracts" component={ContractsScreen} />
      <Tab.Screen name="Invoices" component={InvoicesScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

export default function AppTabs() {
  return (
    <Stack.Navigator screenOptions={darkScreen}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Accounting" component={AccountingScreen} />
      <Stack.Screen name="Cashflow" component={CashflowScreen} />
      <Stack.Screen name="Stocks" component={StocksScreen} />
      <Stack.Screen name="AccountStatement" component={AccountStatementScreen} />
      <Stack.Screen name="CompanyExpenses" component={CompanyExpensesScreen} />
      <Stack.Screen name="ContractsReview" component={ContractsReviewScreen} />
      <Stack.Screen name="ContractsStatement" component={ContractsStatementScreen} />
      <Stack.Screen name="InvoicesReview" component={InvoicesReviewScreen} />
      <Stack.Screen name="InvoicesStatement" component={InvoicesStatementScreen} />
      <Stack.Screen name="Margins" component={MarginsScreen} />
      <Stack.Screen name="MaterialTables" component={MaterialTablesScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SpecialInvoices" component={SpecialInvoicesScreen} />
      <Stack.Screen name="Analysis" component={AnalysisScreen} />
      <Stack.Screen name="Assistant" component={AssistantScreen} />
      <Stack.Screen name="Formulas" component={FormulasScreen} />
      <Stack.Screen name="SharonAdmin" component={SharonAdminScreen} />
      <Stack.Screen name="Shipment" component={ShipmentScreen} />
      <Stack.Screen name="SupplierManagement" component={SupplierManagementScreen} />
      <Stack.Screen name="ClientManagement" component={ClientManagementScreen} />
      <Stack.Screen name="CompanyDetails" component={CompanyDetailsScreen} />
      <Stack.Screen name="BankAccounts" component={BankAccountsScreen} />
      <Stack.Screen name="StocksConfig" component={StocksConfigScreen} />
      <Stack.Screen name="UsersManagement" component={UsersScreen} />
      <Stack.Screen name="InventoryReview" component={InventoryReviewScreen} />
      <Stack.Screen name="Setup" component={SetupScreen} />
    </Stack.Navigator>
  );
}
