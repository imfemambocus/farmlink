// app/(auth)/farmer/homepage.tsx - Complete Fixed Version
import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions
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
    category?: string;
    description?: string;
    farmer_id?: number;
    farmer_name?: string;
    farmer_district?: string;
    lowest_price?: number;
    unit_prices: UnitPrice[];
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

interface DashboardStats {
    totalProducts: number;
    activeProducts: number;
    totalSales: number;
    grossRevenue: number;
    netRevenue: number;
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
    const [loadingSales, setLoadingSales] = useState(false);
    const [loadingRevenue, setLoadingRevenue] = useState(false);
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

    // Touch handler to close dropdowns when tapping outside
    const handleScreenTouch = () => {
        if (showSalesTimePeriodPicker) {
            setShowSalesTimePeriodPicker(false);
        }
        if (showRevenueTimePeriodPicker) {
            setShowRevenueTimePeriodPicker(false);
        }
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
    }, [user]);

    // Separate effect for sales period changes
    useEffect(() => {
        if (user?.role === 'farmer') {
            fetchSalesData();
        }
    }, [salesTimePeriod, user]);

    // Separate effect for revenue period changes
    useEffect(() => {
        if (user?.role === 'farmer') {
            fetchRevenueData();
        }
    }, [revenueTimePeriod, user]);

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

            // Update product stats
            setStats(prev => ({
                ...prev,
                totalProducts,
                activeProducts
            }));

            // Fetch sales and revenue data
            await Promise.all([
                fetchSalesData(),
                fetchRevenueData()
            ]);

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            showAlert(
                'error',
                'error',
                'failed to load dashboard data',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchSalesData = async () => {
        try {
            setLoadingSales(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const salesResponse = await api.get(`/orders/farmer/sales/${salesTimePeriod}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const salesCount = salesResponse.data?.total_sales || 0;

            setStats(prev => ({
                ...prev,
                totalSales: salesCount
            }));

        } catch (salesError: any) {
            console.error('Error fetching sales data:', salesError);
            // Don't show alert for sales errors, just set to 0
            setStats(prev => ({
                ...prev,
                totalSales: 0
            }));
        } finally {
            setLoadingSales(false);
        }
    };

    const fetchRevenueData = async () => {
        try {
            setLoadingRevenue(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const revenueResponse = await api.get(`/orders/farmer/revenue/${revenueTimePeriod}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const grossRevenue = revenueResponse.data?.grossRevenue || 0;
            const netRevenue = revenueResponse.data?.netRevenue || 0;

            setStats(prev => ({
                ...prev,
                grossRevenue: Number(grossRevenue),
                netRevenue: Number(netRevenue)
            }));

        } catch (revenueError: any) {
            console.error('Error fetching revenue data:', revenueError);
            // Don't show alert for revenue errors, just set to 0
            setStats(prev => ({
                ...prev,
                grossRevenue: 0,
                netRevenue: 0
            }));
        } finally {
            setLoadingRevenue(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const handleSalesTimePeriodChange = (newPeriod: TimePeriod) => {
        setSalesTimePeriod(newPeriod);
        setShowSalesTimePeriodPicker(false);
    };

    const handleRevenueTimePeriodChange = (newPeriod: TimePeriod) => {
        setRevenueTimePeriod(newPeriod);
        setShowRevenueTimePeriodPicker(false);
    };

    const handleAddProduct = () => {
        router.push('/farmer/add-product');
    };

    const handleEditProduct = (product: Product) => {
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

    // Calculate number of columns based on screen width
    const getNumColumns = () => {
        if (screenWidth < 390) return 1;
        if (screenWidth < 768) return 2;
        return 3;
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

    const getSalesTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === salesTimePeriod);
        return option ? option.label : 'this month';
    };

    const getRevenueTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === revenueTimePeriod);
        return option ? option.label : 'this month';
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
        <TouchableWithoutFeedback onPress={handleScreenTouch}>
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
                        <Text className="text-xl font-semibold text-black mb-2">
                            welcome back, {user?.farmer_profile?.first_name.toLowerCase()}!
                        </Text>
                        <Text className="text-base text-gray-600">
                            here&#39;s your farm&#39;s performance overview
                        </Text>
                    </View>

                    {/* Statistics Cards - FIXED VERSION */}
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

                        {/* Bottom Row with Fixed Dropdowns */}
                        <View className="flex-row gap-2">
                            {/* Sales Card with Fixed Dropdown */}
                            <View className="flex-1 relative overflow-hidden">
                                <View className="bg-white rounded-xl p-4 border border-gray-200 relative overflow-visible" style={{ height: 120 }}>
                                    {/* Background Icon */}
                                    <View
                                        className="absolute -bottom-3 -right-3 rounded-full items-center justify-center"
                                        style={{
                                            width: 80,
                                            height: 80,
                                            backgroundColor: '#FF980015'
                                        }}
                                    >
                                        <Ionicons name="bag-handle-outline" size={40} color="#FF980060" />
                                    </View>

                                    {/* Content */}
                                    <View className="flex-1 justify-between relative z-10">
                                        {/* Header with Dropdown Button */}
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-sm font-medium text-gray-700">total sales</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowSalesTimePeriodPicker(!showSalesTimePeriodPicker)}
                                                className="p-1"
                                                activeOpacity={0.7}
                                                disabled={loadingSales}
                                            >
                                                <Ionicons
                                                    name={showSalesTimePeriodPicker ? "chevron-up" : "chevron-down"}
                                                    size={16}
                                                    color="#666666"
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Main Value */}
                                        <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                                            {loadingSales ? "..." : stats.totalSales}
                                        </Text>

                                        {/* Subtitle with period */}
                                        <Text className="text-xs text-gray-500" style={{ marginTop: 4 }}>
                                            {getSalesTimePeriodLabel()}
                                        </Text>

                                        {/* Loading Indicator */}
                                        {loadingSales && (
                                            <View className="absolute top-2 right-8">
                                                <ActivityIndicator size={12} color="#FF9800" />
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Dropdown Menu - Fixed Positioning */}
                                {showSalesTimePeriodPicker && (
                                    <View
                                        className="absolute bg-white rounded-xl border border-gray-200 shadow-lg z-50"
                                        style={{
                                            top: 125, // Position below the card
                                            right: 0,
                                            minWidth: 140,
                                            maxHeight: 200,
                                            elevation: 10 // Android shadow
                                        }}
                                    >
                                        <ScrollView className="max-h-48 p-2">
                                            {timePeriodOptions.map((option) => (
                                                <TouchableOpacity
                                                    key={option.key}
                                                    onPress={() => handleSalesTimePeriodChange(option.key)}
                                                    className={`py-2 px-3 rounded-lg ${
                                                        salesTimePeriod === option.key ? 'bg-gray-100' : ''
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
                                )}
                            </View>

                            {/* Revenue Card with Fixed Dropdown */}
                            <View className="flex-1 relative overflow-hidden">
                                <View className="bg-white rounded-xl p-4 border border-gray-200 relative overflow-visible" style={{ height: 120 }}>
                                    {/* Background Icon */}
                                    <View
                                        className="absolute -bottom-3 -right-3 rounded-full items-center justify-center"
                                        style={{
                                            width: 80,
                                            height: 80,
                                            backgroundColor: '#9C27B015'
                                        }}
                                    >
                                        <Ionicons name="trending-up-outline" size={40} color="#9C27B060" />
                                    </View>

                                    {/* Content */}
                                    <View className="flex-1 justify-between relative z-10">
                                        {/* Header with Dropdown Button */}
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-sm font-medium text-gray-700">revenue</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowRevenueTimePeriodPicker(!showRevenueTimePeriodPicker)}
                                                className="p-1"
                                                activeOpacity={0.7}
                                                disabled={loadingRevenue}
                                            >
                                                <Ionicons
                                                    name={showRevenueTimePeriodPicker ? "chevron-up" : "chevron-down"}
                                                    size={16}
                                                    color="#666666"
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Main Value */}
                                        <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                                            {loadingRevenue ? "..." : `rs ${stats.netRevenue.toFixed(0)}`}
                                        </Text>

                                        {/* Subtitle with period and gross revenue */}
                                        <View style={{ marginTop: 4 }}>
                                            <Text className="text-xs text-gray-500">
                                                {getRevenueTimePeriodLabel()}
                                            </Text>
                                            {!loadingRevenue && (
                                                <Text className="text-xs text-gray-400">
                                                    gross: rs {stats.grossRevenue.toFixed(0)}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Loading Indicator */}
                                        {loadingRevenue && (
                                            <View className="absolute top-2 right-8">
                                                <ActivityIndicator size={12} color="#9C27B0" />
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Dropdown Menu - Fixed Positioning */}
                                {showRevenueTimePeriodPicker && (
                                    <View
                                        className="absolute bg-white rounded-xl border border-gray-200 shadow-lg z-50"
                                        style={{
                                            top: 125, // Position below the card
                                            right: 0,
                                            minWidth: 140,
                                            maxHeight: 200,
                                            elevation: 10 // Android shadow
                                        }}
                                    >
                                        <ScrollView className="max-h-48 p-2">
                                            {timePeriodOptions.map((option) => (
                                                <TouchableOpacity
                                                    key={option.key}
                                                    onPress={() => handleRevenueTimePeriodChange(option.key)}
                                                    className={`py-2 px-3 rounded-lg ${
                                                        revenueTimePeriod === option.key ? 'bg-gray-100' : ''
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
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Products Section */}
                    <View className="px-5">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-medium text-black">
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
                            key={`${getNumColumns()}-${activeTab}`}
                            scrollEnabled={false}
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
        </TouchableWithoutFeedback>
    );
}