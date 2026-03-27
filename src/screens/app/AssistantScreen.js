import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../contexts/AuthContext';
import { loadData } from '../../shared/utils/firestore';
import AppHeader from '../../components/AppHeader';
import { COLLECTIONS } from '../../constants/collections';

const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are an intelligent assistant for IMS (Inventory Management System) - a metals trading and inventory management platform. You help users navigate the system, answer questions, look up data, and guide them through workflows.

## SYSTEM OVERVIEW
This IMS system manages:
- **Contracts**: Purchase orders from suppliers with products, pricing, shipment details
- **Invoices**: Sales invoices to clients with products, payments, delivery info
- **Expenses**: Company and contract-related expenses
- **Stocks/Inventory**: Material tracking across warehouses
- **Settings**: Suppliers, clients, shipment types, origins, delivery terms, ports

## KEY FEATURES YOU CAN HELP WITH:

### 1. DATA LOOKUPS
When users ask about data, use the provided context to answer:
- Overdue invoices (where payment is pending past due date)
- Contract status and details
- Invoice amounts and payment status
- Expense summaries
- Stock availability

### 2. WORKFLOW GUIDANCE
Guide users step-by-step for:
- Creating a new contract: Go to Contracts → Click "Add Contract" → Fill supplier, date, products, pricing
- Creating an invoice: Go to Invoices → Click "Add Invoice" → Select client, add products, set payment terms
- Adding expenses: Go to Expenses → Click "Add Expense" → Enter details, link to contract if applicable
- Managing settings: Go to Settings → Add/edit suppliers, clients, shipment types, etc.

### 3. NAVIGATION HELP
- Contracts: Manage purchase contracts
- Invoices: Manage sales invoices
- Expenses: Track expenses
- Dashboard: View analytics and charts
- Stocks: Inventory management
- Settings: Configure system options
- Analysis: Weight and quantity analysis
- Cash Flow: Financial flow tracking
- Account Statements: Generate statements

### 4. FAQ RESPONSES
Common questions:
- "How do I add a new customer?" → Go to Settings, find the Client/Consignee section, click Add, enter details
- "How do I link an invoice to a contract?" → When creating invoice, use the PO Supplier field to select the contract
- "How do I filter by date?" → Use the year picker at the top of each page

## RESPONSE GUIDELINES:
1. Be concise but helpful - keep responses short for mobile chat
2. NEVER use markdown tables - they don't render well in chat
3. For data lists, use simple bullet points with "•" symbol
4. Format each item on its own line for readability
5. For workflow guidance, use numbered steps (1. 2. 3.)
6. Use **bold** sparingly for emphasis
7. Keep responses under 300 words when possible
8. Always be professional and supportive

## DATA FORMATTING RULES:
When showing contracts, invoices, or expenses:
- Use bullet points, NOT tables
- Format: • PO# 123456 - Supplier Name - Date
- One item per line
- Add a summary line at the end (e.g., "Total: 5 contracts")

## DATA CONTEXT:
You will receive current data context with each message including contracts, invoices, and expenses. Use this to answer data-related queries accurately.
`;

function processDataQuery(query, data) {
  const lowerQuery = query.toLowerCase();
  const { contracts, invoices, expenses } = data;

  if (lowerQuery.includes('overdue') && lowerQuery.includes('invoice')) {
    const today = new Date();
    const overdueInvoices = (invoices || []).filter(inv => {
      if (inv.invoiceStatus === 'Paid' || inv.canceled) return false;
      const dueDate = inv.delDate?.endDate ? new Date(inv.delDate.endDate) : null;
      return dueDate && dueDate < today;
    });
    return {
      type: 'overdue_invoices',
      data: overdueInvoices.map(inv => ({
        invoice: inv.invoice, client: inv.client,
        amount: inv.totalAmount, currency: inv.cur,
        dueDate: inv.delDate?.endDate, status: inv.invoiceStatus,
      })),
    };
  }

  if (lowerQuery.includes('pending') && lowerQuery.includes('invoice')) {
    const pending = (invoices || []).filter(inv => inv.invoiceStatus !== 'Paid' && !inv.canceled);
    return {
      type: 'pending_invoices',
      data: pending.map(inv => ({
        invoice: inv.invoice, client: inv.client,
        amount: inv.totalAmount, currency: inv.cur, status: inv.invoiceStatus,
      })),
    };
  }

  if (lowerQuery.includes('contract') && (lowerQuery.includes('show') || lowerQuery.includes('list') || lowerQuery.includes('find'))) {
    return {
      type: 'contracts_list',
      data: (contracts || []).slice(0, 10).map(con => ({
        order: con.order, supplier: con.supplier,
        date: con.date, status: con.conStatus,
      })),
    };
  }

  if (lowerQuery.includes('expense') && (lowerQuery.includes('total') || lowerQuery.includes('summary'))) {
    const total = (expenses || []).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    return { type: 'expense_summary', data: { total, count: expenses?.length || 0 } };
  }

  return null;
}

function formatDataForAI(result) {
  if (!result) return '';
  switch (result.type) {
    case 'overdue_invoices':
      if (!result.data.length) return '\n[DATA RESULT]: No overdue invoices found. All invoices are current.';
      return `\n[DATA RESULT - OVERDUE INVOICES]:\n${result.data.map(inv =>
        `• Invoice #${inv.invoice} - Client: ${inv.client} - Amount: ${inv.currency} ${inv.amount} - Due: ${inv.dueDate}`
      ).join('\n')}\nTotal overdue: ${result.data.length} invoice(s)`;
    case 'pending_invoices':
      if (!result.data.length) return '\n[DATA RESULT]: No pending invoices found.';
      return `\n[DATA RESULT - PENDING INVOICES]:\n${result.data.map(inv =>
        `• Invoice #${inv.invoice} - Client: ${inv.client} - Amount: ${inv.currency} ${inv.amount} - Status: ${inv.status}`
      ).join('\n')}\nTotal pending: ${result.data.length} invoice(s)`;
    case 'contracts_list':
      if (!result.data.length) return '\n[DATA RESULT]: No contracts found.';
      return `\n[DATA RESULT - CONTRACTS]:\n${result.data.map(con =>
        `• Order: ${con.order} - Supplier: ${con.supplier} - Date: ${con.date} - Status: ${con.status}`
      ).join('\n')}`;
    case 'expense_summary':
      return `\n[DATA RESULT - EXPENSE SUMMARY]:\n• Total Expenses: ${result.data.total.toFixed(2)}\n• Number of Records: ${result.data.count}`;
    default:
      return '';
  }
}

const QUICK_ACTIONS = [
  'Show overdue invoices',
  'List contracts',
  'Expense summary',
  'Pending invoices',
];

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
    anim(dot1, 0);
    anim(dot2, 200);
    anim(dot3, 400);
  }, []);

  return (
    <View style={styles.dotsRow}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
      ))}
    </View>
  );
}

export default function AssistantScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection } = UserAuth();
  const [messages, setMessages] = useState([
    { id: '0', role: 'assistant', text: "Hi! I'm your IMS Assistant. Ask me anything about your contracts, invoices, or expenses." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentData, setCurrentData] = useState({ contracts: [], invoices: [], expenses: [] });
  const listRef = useRef(null);

  useEffect(() => {
    if (!uidCollection) return;
    const year = new Date().getFullYear();
    const dateSelect = { start: `${year}-01-01`, end: `${year}-12-31` };
    Promise.all([
      loadData(uidCollection, COLLECTIONS.CONTRACTS, dateSelect),
      loadData(uidCollection, COLLECTIONS.INVOICES, dateSelect),
      loadData(uidCollection, COLLECTIONS.EXPENSES, dateSelect),
    ]).then(([contracts, invoices, expenses]) => {
      setCurrentData({ contracts: contracts || [], invoices: invoices || [], expenses: expenses || [] });
    }).catch(() => {});
  }, [uidCollection]);

  const scrollToEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', text: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    scrollToEnd();

    try {
      const history = [...messages, userMsg]
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.text }));

      const queryResult = processDataQuery(msg, currentData);
      const dataContext = formatDataForAI(queryResult);

      const systemContent = SYSTEM_PROMPT +
        `\n\n## CURRENT DATA SUMMARY:\n- Total Contracts: ${currentData.contracts.length}\n- Total Invoices: ${currentData.invoices.length}\n- Total Expenses: ${currentData.expenses.length}${dataContext}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemContent }, ...history],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const json = await res.json();
      const reply = json.choices?.[0]?.message?.content || 'Sorry, I could not generate a response. Please try again.';
      setMessages(prev => [...prev, { id: Date.now().toString() + '_r', role: 'assistant', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString() + '_e', role: 'assistant', text: 'Connection error. Please check your internet and try again.' }]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  const renderItem = ({ item }) => {
    if (item.role === 'user') {
      return (
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={[styles.bubbleText, styles.userText]}>{item.text}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.bubble, styles.botBubble]}>
        <View style={styles.botIcon}><Ionicons name="sparkles" size={14} color="#0366ae" /></View>
        <Text style={[styles.bubbleText]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <AppHeader title="Assistant" navigation={navigation} showBack />

      <FlatList
        ref={listRef}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onContentSizeChange={scrollToEnd}
        ListFooterComponent={loading ? (
          <View style={[styles.bubble, styles.botBubble]}>
            <View style={styles.botIcon}><Ionicons name="sparkles" size={14} color="#0366ae" /></View>
            <TypingDots />
          </View>
        ) : null}
      />

      {/* Quick action chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsBar}
        contentContainerStyle={styles.chipsContent}
      >
        {QUICK_ACTIONS.map(action => (
          <TouchableOpacity
            key={action}
            style={styles.chip}
            onPress={() => send(action)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your data..."
          placeholderTextColor="#9fb8d4"
          onSubmitEditing={() => send()}
          returnKeyType="send"
          editable={!loading}
        />
        <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={() => send()} activeOpacity={0.8} disabled={loading}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  list: { padding: 16, gap: 10, paddingBottom: 8 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16 },
  botBubble: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8',
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  userBubble: { backgroundColor: '#0366ae', alignSelf: 'flex-end' },
  botIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  bubbleText: { fontSize: 14, color: '#103a7a', flex: 1, flexWrap: 'wrap', lineHeight: 20 },
  userText: { color: '#fff' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#9fb8d4' },
  chipsBar: { flexGrow: 0, borderTopWidth: 1, borderTopColor: '#e3f3ff' },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#ebf2fc', borderRadius: 999,
    borderWidth: 1, borderColor: '#b8ddf8',
  },
  chipText: { fontSize: 12, color: '#0366ae', fontWeight: '600' },
  inputBar: {
    backgroundColor: '#e3f3ff', borderTopWidth: 1, borderTopColor: '#b8ddf8',
    padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center',
  },
  input: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#103a7a',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#0366ae', justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#9fb8d4' },
});
