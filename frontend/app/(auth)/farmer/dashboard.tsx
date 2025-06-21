import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    Dimensions,
    TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import StatCard from '@/components/farmer/StatCard';
import ProductCard from '@/components/farmer/ProductCard';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import CustomAlert from '@/components/ui/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UnitPrice } from "@/types";

interface Product {
    id: number;
    item: string;
    description?: string;
    is_active: boolean;
    unit_prices: UnitPrice[];
    created_at: string;
    updated_at: string;
}

interface DashboardStats {
    totalProducts: number;
    activeProducts: number;
    totalSales: number;
    grossRevenue: number;
    netRevenue: number;
}

interface OrderSummary {
    total_orders: number;
    confirmed_orders: number;
    processing_orders: number;
    out_for_delivery_orders: number;
    delivered_orders: number;
    total_gross_revenue: number;
    total_net_revenue: number;
    pending_revenue: number;
}

interface EarningsSummary {
    total_gross_earnings: number;
    total_net_earnings: number;
    total_orders: number;
    total_platform_fees: number;
    paid_amount: number;
    pending_amount: number;
    recent_payments: Array<{
        created_at: string;
        gross_amount: number;
        net_amount: number;
        order_number: string;
        platform_fee: number;
        status: string;
    }>;
    period_summary?: {
        [key: string]: {
            gross_earnings: number;
            net_earnings: number;
            orders_count: number;
        }
    }
}

interface AlertState {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }>;
}

type CategoryTab = 'all' | 'fruits' | 'vegetables';
type TimePeriod = 'this_month' | 'this_week' | 'this_year' | 'all_time' | 'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december';

export default function FarmerDashboard() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalProducts: 0,
        activeProducts: 0,
        totalSales: 0,
        grossRevenue: 0,
        netRevenue: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    const [activeTab, setActiveTab] = useState<CategoryTab>('all');
    const [salesTimePeriod, setSalesTimePeriod] = useState<TimePeriod>('this_month');
    const [revenueTimePeriod, setRevenueTimePeriod] = useState<TimePeriod>('this_month');
    const [showSalesTimePeriodPicker, setShowSalesTimePeriodPicker] = useState(false);
    const [showRevenueTimePeriodPicker, setShowRevenueTimePeriodPicker] = useState(false);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    // Define which items are fruits vs vegetables
    const fruitItems = new Set([
        'apple', 'banana', 'orange', 'mango', 'pineapple', 'papaya',
        'guava', 'lychee', 'coconut', 'lemon', 'lime', 'watermelon',
        'melon', 'grapes', 'strawberry'
    ]);

    const vegetableItems = new Set([
        'tomato', 'potato', 'onion', 'carrot', 'cabbage', 'lettuce',
        'spinach', 'broccoli', 'cauliflower', 'bell_pepper', 'chili',
        'cucumber', 'eggplant', 'okra', 'green_beans', 'pumpkin',
        'beetroot', 'radish', 'ginger', 'garlic'
    ]);

    const timePeriodOptions = [
        { key: 'this_month' as TimePeriod, label: 'this month' },
        { key: 'this_week' as TimePeriod, label: 'this week' },
        { key: 'this_year' as TimePeriod, label: 'this year' },
        { key: 'all_time' as TimePeriod, label: 'all time' },
        { key: 'january' as TimePeriod, label: 'january' },
        { key: 'february' as TimePeriod, label: 'february' },
        { key: 'march' as TimePeriod, label: 'march' },
        { key: 'april' as TimePeriod, label: 'april' },
        { key: 'may' as TimePeriod, label: 'may' },
        { key: 'june' as TimePeriod, label: 'june' },
        { key: 'july' as TimePeriod, label: 'july' },
        { key: 'august' as TimePeriod, label: 'august' },
        { key: 'september' as TimePeriod, label: 'september' },
        { key: 'october' as TimePeriod, label: 'october' },
        { key: 'november' as TimePeriod, label: 'november' },
        { key: 'december' as TimePeriod, label: 'december' },
    ];

    const showAlert = (
        type: 'success' | 'error' | 'warning' | 'info',
        title: string,
        message: string,
        buttons: Array<{
            text: string;
            onPress: () => void;
            style?: 'default' | 'cancel' | 'destructive';
        }>
    ) => {
        setAlert({
            visible: true,
            type,
            title,
            message,
            buttons
        });
    };

    const hideAlert = () => {
        setAlert(prev => ({ ...prev, visible: false }));
    };

    useEffect(() => {
        if (user?.role !== 'farmer') {
            router.replace('/(auth)');
            return;
        }
        fetchDashboardData();

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user, salesTimePeriod, revenueTimePeriod]);

    const getWeekNumber = (date: Date): number => {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    };

    const getPeriodDataFromOrders = (orders: any[], timePeriod: TimePeriod) => {
        if (!orders || orders.length === 0) {
            return { gross_earnings: 0, net_earnings: 0, orders_count: 0 };
        }

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const currentWeek = getWeekNumber(new Date());

        let filteredOrders = orders;

        switch (timePeriod) {
            case 'this_month':
                filteredOrders = orders.filter(order => {
                    const orderDate = new Date(order.created_at);
                    return orderDate.getFullYear() === currentYear &&
                        orderDate.getMonth() + 1 === currentMonth;
                });
                break;
            case 'this_week':
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                filteredOrders = orders.filter(order => {
                    const orderDate = new Date(order.created_at);
                    return orderDate >= oneWeekAgo;
                });
                break;
            case 'this_year':
                filteredOrders = orders.filter(order => {
                    const orderDate = new Date(order.created_at);
                    return orderDate.getFullYear() === currentYear;
                });
                break;
            case 'all_time':
                // Keep all orders
                break;
            default:
                // Handle specific months (january, february, etc.)
                const monthIndex = timePeriodOptions.findIndex(opt => opt.key === timePeriod);
                if (monthIndex >= 4) { // First 4 are non-month options
                    const targetMonth = monthIndex - 3; // Convert to 1-based month
                    filteredOrders = orders.filter(order => {
                        const orderDate = new Date(order.created_at);
                        return orderDate.getFullYear() === currentYear &&
                            orderDate.getMonth() + 1 === targetMonth;
                    });
                }
                break;
        }

        const totalGross = filteredOrders.reduce((sum, order) => sum + Number(order.gross_amount || 0), 0);
        const totalNet = filteredOrders.reduce((sum, order) => sum + Number(order.net_amount || 0), 0);

        return {
            gross_earnings: totalGross,
            net_earnings: totalNet,
            orders_count: filteredOrders.length
        };
    };

    const getSalesTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === salesTimePeriod);
        return option ? option.label : 'this month';
    };

    const getRevenueTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === revenueTimePeriod);
        return option ? option.label : 'this month';
    };

    // Calculate number of columns based on screen width
    const getNumColumns = () => {
        if (screenWidth < 390) return 1; // Very small screens (phones in portrait)
        if (screenWidth < 768) return 2; // Normal phones and small tablets
        return 3; // Tablets and larger screens
    };

    // Filter products based on active tab
    const getFilteredProducts = () => {
        if (activeTab === 'all') return products;
        if (activeTab === 'fruits') {
            return products.filter(product => fruitItems.has(product.item));
        }
        if (activeTab === 'vegetables') {
            return products.filter(product => vegetableItems.has(product.item));
        }
        return products;
    };

    const fetchDashboardData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            // Fetch farmer's products
            const productsResponse = await api.get('/products/my', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setProducts(productsResponse.data || []);

            // Calculate basic stats from products
            const totalProducts = (productsResponse.data || []).length;
            const activeProducts = (productsResponse.data || []).filter((p: Product) => p.is_active).length;

            // Initialize separate stats for sales and revenue
            let salesGrossRevenue = 0;
            let salesNetRevenue = 0;
            let salesCount = 0;

            let revenueGrossRevenue = 0;
            let revenueNetRevenue = 0;
            let revenueCount = 0;

            try {
                // Try to fetch order summary
                const orderSummaryResponse = await api.get('/orders/farmer/orders/summary', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (orderSummaryResponse.data) {
                    const orderSummary: OrderSummary = orderSummaryResponse.data;

                    // Use order summary data as fallback for both sales and revenue
                    salesCount = orderSummary.total_orders || 0;
                    revenueGrossRevenue = orderSummary.total_gross_revenue || 0;
                    revenueNetRevenue = orderSummary.total_net_revenue || 0;
                }
            } catch (orderError) {
                console.error('Order summary not available:', orderError);
                // Continue with default values
            }

            try {
                // Try to fetch earnings data for more detailed breakdown
                const earningsResponse = await api.get('/orders/farmer/earnings', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (earningsResponse.data) {
                    const earnings: EarningsSummary = earningsResponse.data;

                    // Calculate sales data based on sales time period
                    if (salesTimePeriod === 'all_time') {
                        salesCount = earnings.total_orders || 0;
                    } else {
                        // Use recent_payments to filter by time period
                        const salesPeriodData = getPeriodDataFromOrders(earnings.recent_payments || [], salesTimePeriod);
                        salesCount = salesPeriodData.orders_count;
                    }

                    // Calculate revenue data based on revenue time period
                    if (revenueTimePeriod === 'all_time') {
                        revenueGrossRevenue = earnings.total_gross_earnings || 0;
                        revenueNetRevenue = earnings.total_net_earnings || 0;
                    } else {
                        // Use recent_payments to filter by time period
                        const revenuePeriodData = getPeriodDataFromOrders(earnings.recent_payments || [], revenueTimePeriod);
                        revenueGrossRevenue = revenuePeriodData.gross_earnings;
                        revenueNetRevenue = revenuePeriodData.net_earnings;
                    }
                }
            } catch (earningsError) {
                console.error('Earnings data not available:', earningsError);
                // Continue with order summary data or defaults
            }

            setStats({
                totalProducts,
                activeProducts,
                totalSales: salesCount,
                grossRevenue: Number(revenueGrossRevenue) || 0,
                netRevenue: Number(revenueNetRevenue) || 0
            });

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            console.error('Error details:', error.response?.data);

            // Set basic stats from products if available, show error for others
            const totalProducts = products.length;
            const activeProducts = products.filter((p: Product) => p.is_active).length;

            setStats({
                totalProducts,
                activeProducts,
                totalSales: 0,
                grossRevenue: 0,
                netRevenue: 0
            });

            showAlert(
                'warning',
                'partial data loaded',
                'some dashboard data could not be loaded. products are shown but sales/revenue data may be unavailable.',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const handleAddProduct = () => {
        router.push('/farmer/add-product');
    };

    const handleEditProduct = (product: Product) => {
        // Navigate to edit screen with product data
        router.push(`/farmer/edit-product/${product.id}`);
    };

    const handleToggleProductStatus = async (productId: number, newStatus: boolean) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            await api.put(`/products/${productId}`,
                { is_active: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local state
            setProducts(prev =>
                prev.map(p =>
                    p.id === productId ? { ...p, is_active: newStatus } : p
                )
            );

            // Update stats
            setStats(prev => ({
                ...prev,
                activeProducts: prev.activeProducts + (newStatus ? 1 : -1)
            }));

            showAlert(
                'success',
                'success',
                `product ${newStatus ? 'listed' : 'unlisted'} successfully`,
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );

        } catch (error: any) {
            console.error('Error updating product status:', error);
            showAlert(
                'error',
                'error',
                'failed to update product status',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        }
    };

    const EmptyProductsComponent = ({ category }: { category: CategoryTab }) => {
        const getEmptyMessage = () => {
            switch (category) {
                case 'fruits':
                    return {
                        emoji: '🍎',
                        title: 'no fruits yet',
                        subtitle: 'you haven\'t listed any fruits for sale'
                    };
                case 'vegetables':
                    return {
                        emoji: '🥕',
                        title: 'no vegetables yet',
                        subtitle: 'you haven\'t listed any vegetables for sale'
                    };
                default:
                    return {
                        emoji: '🌱',
                        title: 'no products yet',
                        subtitle: 'start by adding your first product to begin selling on farmlink'
                    };
            }
        };

        const message = getEmptyMessage();

        return (
            <View className="bg-surface rounded-xl p-8 items-center mx-6">
                <Text className="text-6xl mb-4">{message.emoji}</Text>
                <Text className="text-lg font-medium text-black mb-2">
                    {message.title}
                </Text>
                <Text className="text-gray-600 text-center mb-4">
                    {message.subtitle}
                </Text>
            </View>
        );
    };

    const TabButton = ({ tab, title, isActive, onPress }: {
        tab: CategoryTab;
        title: string;
        isActive: boolean;
        onPress: () => void;
    }) => (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-1 py-2 px-4 rounded-lg ${
                isActive ? 'bg-background' : 'bg-gray-100'
            }`}
            activeOpacity={0.7}
        >
            <Text className={`text-center font-medium text-sm ${
                isActive ? 'text-black' : 'text-gray-600'
            }`}>
                {title}
            </Text>
        </TouchableOpacity>
    );

    const SalesTimePeriodPicker = () => (
        <View className="absolute top-12 right-0 bg-white rounded-xl border border-gray-200 p-2 z-10 min-w-[120px]">
            <ScrollView className="max-h-48">
                {timePeriodOptions.map((option) => (
                    <TouchableOpacity
                        key={option.key}
                        onPress={() => {
                            setSalesTimePeriod(option.key);
                            setShowSalesTimePeriodPicker(false);
                        }}
                        className={`py-2 px-3 rounded-lg ${
                            salesTimePeriod === option.key ? 'bg-background' : ''
                        }`}
                        activeOpacity={0.7}
                    >
                        <Text className={`text-sm ${
                            salesTimePeriod === option.key ? 'text-black font-medium' : 'text-gray-600'
                        }`}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const RevenueTimePeriodPicker = () => (
        <View className="absolute top-12 right-0 bg-white rounded-xl border border-gray-200 p-2 z-10 min-w-[120px]">
            <ScrollView className="max-h-48">
                {timePeriodOptions.map((option) => (
                    <TouchableOpacity
                        key={option.key}
                        onPress={() => {
                            setRevenueTimePeriod(option.key);
                            setShowRevenueTimePeriodPicker(false);
                        }}
                        className={`py-2 px-3 rounded-lg ${
                            revenueTimePeriod === option.key ? 'bg-background' : ''
                        }`}
                        activeOpacity={0.7}
                    >
                        <Text className={`text-sm ${
                            revenueTimePeriod === option.key ? 'text-black font-medium' : 'text-gray-600'
                        }`}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const filteredProducts = getFilteredProducts();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((filteredProducts.length - 1) / numColumns);

        return (
            <View
                style={{
                    flex: 1,
                    marginBottom: isLastRow ? 0 : 12,
                    marginHorizontal: 4,
                    maxWidth: `${100 / numColumns - 2}%`
                }}
            >
                <ProductCard
                    product={item}
                    onEdit={handleEditProduct}
                    onToggleStatus={handleToggleProductStatus}
                />
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header title="dashboard" showSettingsButton={true} showOrdersButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading dashboard...</Text>
                </View>
            </View>
        );
    }

    const filteredProducts = getFilteredProducts();

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="dashboard"
                showSettingsButton={true}
                showOrdersButton={true}
                showNotificationButton={true}
            />

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#4CAF50']}
                    />
                }
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Welcome Section */}
                <View className="px-5 pt-6 pb-4">
                    <Text className="text-xl font-medium text-black mb-2">
                        welcome back, {user?.farmer_profile?.first_name.toLowerCase()}!
                    </Text>
                    <Text className="text-base text-gray-600">
                        here&#39;s your farm&#39;s performance overview
                    </Text>
                </View>

                {/* Statistics Cards */}
                <View className="px-5 mb-6">
                    <View className="flex-row mb-3">
                        <StatCard
                            title="total products"
                            value={stats.totalProducts}
                            icon="leaf-outline"
                            color="#4CAF50"
                        />
                        <StatCard
                            title="active listings"
                            value={stats.activeProducts}
                            icon="checkmark-circle-outline"
                            color="#2196F3"
                        />
                    </View>
                    <View className="flex-row">
                        <View className="flex-1 mx-1 relative">
                            <StatCard
                                title="total sales"
                                value={stats.totalSales}
                                icon="bag-handle-outline"
                                color="#FF9800"
                                subtitle={getSalesTimePeriodLabel()}
                            />
                            <TouchableOpacity
                                onPress={() => setShowSalesTimePeriodPicker(!showSalesTimePeriodPicker)}
                                className="absolute top-2 right-2 p-1"
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-down" size={16} color="#666666" />
                            </TouchableOpacity>
                            {showSalesTimePeriodPicker && <SalesTimePeriodPicker />}
                        </View>
                        <View className="flex-1 mx-1 relative">
                            <StatCard
                                title="revenue"
                                value={`rs ${stats.netRevenue.toFixed(0)}`}
                                icon="trending-up-outline"
                                color="#9C27B0"
                                subtitle={`gross: rs ${stats.grossRevenue.toFixed(0)} • ${getRevenueTimePeriodLabel()}`}
                            />
                            <TouchableOpacity
                                onPress={() => setShowRevenueTimePeriodPicker(!showRevenueTimePeriodPicker)}
                                className="absolute top-2 right-2 p-1"
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-down" size={16} color="#666666" />
                            </TouchableOpacity>
                            {showRevenueTimePeriodPicker && <RevenueTimePeriodPicker />}
                        </View>
                    </View>
                </View>

                {/* Products Section */}
                <View className="px-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-xl font-medium text-black">
                            my products
                        </Text>
                        <Text className="text-sm text-gray-500">
                            {filteredProducts.length} {activeTab === 'all' ? 'total' : activeTab}
                        </Text>
                    </View>

                    {/* Tab Navigation */}
                    <View className="flex-row mb-6 rounded-lg flex gap-2">
                        <TabButton
                            tab="all"
                            title="all"
                            isActive={activeTab === 'all'}
                            onPress={() => setActiveTab('all')}
                        />
                        <TabButton
                            tab="fruits"
                            title="fruits"
                            isActive={activeTab === 'fruits'}
                            onPress={() => setActiveTab('fruits')}
                        />
                        <TabButton
                            tab="vegetables"
                            title="vegetables"
                            isActive={activeTab === 'vegetables'}
                            onPress={() => setActiveTab('vegetables')}
                        />
                    </View>
                </View>

                {filteredProducts.length === 0 ? (
                    <EmptyProductsComponent category={activeTab} />
                ) : (
                    <FlatList
                        data={filteredProducts}
                        renderItem={renderProductItem}
                        numColumns={getNumColumns()}
                        key={`${getNumColumns()}-${activeTab}`} // Force re-render when columns or tab changes
                        scrollEnabled={false} // Disable FlatList scroll since we're in ScrollView
                        contentContainerStyle={{ paddingHorizontal: 18 }}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </ScrollView>

            {/* Floating Action Button */}
            <FloatingActionButton
                onPress={handleAddProduct}
                icon="add"
            />

            {/* Custom Alert */}
            <CustomAlert
                visible={alert.visible}
                type={alert.type}
                title={alert.title}
                message={alert.message}
                buttons={alert.buttons}
                onClose={hideAlert}
            />
        </View>
    );
}