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
    Dimensions,
    Modal,
    Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { useTranslation } from '@/context/LanguageContext';
import Header from '@/components/ui/Header';
import StatCard from '@/components/farmer/StatCard';
import ProductCard from '@/components/farmer/ProductCard';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import CustomAlert from '@/components/ui/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/apiService';
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
type PickerType = 'sales' | 'revenue' | null;

export default function FarmerDashboard() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const { t, tDashboard, tCommon } = useTranslation();
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
    const [loadingSales, setLoadingSales] = useState(false);
    const [loadingRevenue, setLoadingRevenue] = useState(false);
    const [activePicker, setActivePicker] = useState<PickerType>(null);
    const [slideAnim] = useState(new Animated.Value(300));
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

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
        { key: 'this_week' as TimePeriod, label: tDashboard('thisWeek'), short: tDashboard('thisWeek') },
        { key: 'this_month' as TimePeriod, label: tDashboard('thisMonth'), short: tDashboard('thisMonth') },
        { key: 'this_year' as TimePeriod, label: tDashboard('thisYear'), short: tDashboard('thisYear') },
        { key: 'all_time' as TimePeriod, label: tDashboard('allTime'), short: tDashboard('allTime') },
        { key: 'january' as TimePeriod, label: tDashboard('january'), short: tDashboard('january') },
        { key: 'february' as TimePeriod, label: tDashboard('february'), short: tDashboard('february') },
        { key: 'march' as TimePeriod, label: tDashboard('march'), short: tDashboard('march') },
        { key: 'april' as TimePeriod, label: tDashboard('april'), short: tDashboard('april') },
        { key: 'may' as TimePeriod, label: tDashboard('may'), short: tDashboard('may') },
        { key: 'june' as TimePeriod, label: tDashboard('june'), short: tDashboard('june') },
        { key: 'july' as TimePeriod, label: tDashboard('july'), short: tDashboard('july') },
        { key: 'august' as TimePeriod, label: tDashboard('august'), short: tDashboard('august') },
        { key: 'september' as TimePeriod, label: tDashboard('september'), short: tDashboard('september') },
        { key: 'october' as TimePeriod, label: tDashboard('october'), short: tDashboard('october') },
        { key: 'november' as TimePeriod, label: tDashboard('november'), short: tDashboard('november') },
        { key: 'december' as TimePeriod, label: tDashboard('december'), short: tDashboard('december') },
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

    const showPicker = (type: PickerType) => {
        setActivePicker(type);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10
        }).start();
    };

    const hidePicker = () => {
        setActivePicker(null);
        Animated.spring(slideAnim, {
            toValue: 300,
            useNativeDriver: true,
            tension: 100,
            friction: 8
        }).start();
    };

    const selectPeriod = (period: TimePeriod) => {
        if (activePicker === 'sales') {
            setSalesTimePeriod(period);
        } else if (activePicker === 'revenue') {
            setRevenueTimePeriod(period);
        }
        hidePicker();
    };

    const getCurrentPeriod = (): TimePeriod => {
        return activePicker === 'sales' ? salesTimePeriod : revenueTimePeriod;
    };

    useEffect(() => {
        if (user?.role !== 'farmer') {
            router.replace('/(auth)');
            return;
        }
        fetchDashboardData();

        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    useEffect(() => {
        if (user?.role === 'farmer') {
            fetchSalesData();
        }
    }, [salesTimePeriod, user]);

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

            const productsResponse = await api.get('/products/my', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setProducts(productsResponse.data || []);

            const totalProducts = (productsResponse.data || []).length;
            const activeProducts = (productsResponse.data || []).filter((p: Product) => p.is_active).length;

            setStats(prev => ({
                ...prev,
                totalProducts,
                activeProducts
            }));

            await Promise.all([
                fetchSalesData(),
                fetchRevenueData()
            ]);

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            showAlert(
                'error',
                tDashboard('error'),
                tDashboard('failedToLoadDashboard'),
                [{ text: tCommon('ok'), onPress: hideAlert, style: 'cancel' }]
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

            setProducts(prev =>
                prev.map(p =>
                    p.id === productId ? { ...p, is_active: newStatus } : p
                )
            );

            setStats(prev => ({
                ...prev,
                activeProducts: prev.activeProducts + (newStatus ? 1 : -1)
            }));

            showAlert(
                'success',
                tDashboard('success'),
                newStatus ? tDashboard('productListedSuccessfully') : tDashboard('productUnlistedSuccessfully'),
                [{ text: tCommon('ok'), onPress: hideAlert, style: 'cancel' }]
            );

        } catch (error: any) {
            console.error('Error updating product status:', error);
            showAlert(
                'error',
                tDashboard('error'),
                tDashboard('failedToUpdateStatus'),
                [{ text: tCommon('ok'), onPress: hideAlert, style: 'cancel' }]
            );
        }
    };

    const EmptyProductsComponent = ({ category }: { category: CategoryTab }) => {
        const getEmptyMessage = () => {
            switch (category) {
                case 'fruits':
                    return {
                        emoji: '🍎',
                        title: tDashboard('noFruits'),
                        subtitle: tDashboard('noFruitsListed')
                    };
                case 'vegetables':
                    return {
                        emoji: '🥕',
                        title: tDashboard('noVegetables'),
                        subtitle: tDashboard('noVegetablesListed')
                    };
                default:
                    return {
                        emoji: '🌱',
                        title: tDashboard('noProducts'),
                        subtitle: tDashboard('startAdding')
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

    const getNumColumns = () => {
        if (screenWidth < 390) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

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
        return option ? option.label.toLowerCase() : tDashboard('thisMonth');
    };

    const getRevenueTimePeriodLabel = (): string => {
        const option = timePeriodOptions.find(opt => opt.key === revenueTimePeriod);
        return option ? option.label.toLowerCase() : tDashboard('thisMonth');
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header title={tCommon('dashboard')} showSettingsButton={true} showOrdersButton={true} />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tDashboard('loadingDashboard')}</Text>
                </View>
            </View>
        );
    }

    const filteredProducts = getFilteredProducts();

    return (
        <View className="flex-1 bg-surface">
            <Header
                title={tCommon('dashboard')}
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
                <View className="px-5 pt-6 pb-4">
                    <Text className="text-xl font-semibold text-black mb-2">
                        {tDashboard('welcomeBack')}, {user?.farmer_profile?.first_name}!
                    </Text>
                    <Text className="text-base text-gray-600">
                        {tDashboard('farmPerformance')}
                    </Text>
                </View>

                <View className="px-5 mb-6">
                    <View className="flex-row mb-3">
                        <StatCard
                            title={tDashboard('totalProducts')}
                            value={stats.totalProducts}
                            icon="leaf-outline"
                            color="#4CAF50"
                        />
                        <StatCard
                            title={tDashboard('activeListings')}
                            value={stats.activeProducts}
                            icon="checkmark-circle-outline"
                            color="#2196F3"
                        />
                    </View>

                    <View className="flex-row gap-2">
                        <View className="flex-1">
                            <View className="bg-white rounded-xl p-4 border border-gray-200 relative" style={{ height: 120, overflow: 'hidden' }}>
                                <View
                                    className="absolute rounded-full items-center justify-center"
                                    style={{
                                        width: 60,
                                        height: 60,
                                        backgroundColor: '#FF980015',
                                        bottom: -10,
                                        right: -10
                                    }}
                                >
                                    <Ionicons name="bag-handle-outline" size={30} color="#FF980060" />
                                </View>

                                <View className="flex-1 justify-between relative z-10">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Text className="text-sm font-medium text-gray-700">{tDashboard('totalSales')}</Text>
                                        <TouchableOpacity
                                            onPress={() => showPicker('sales')}
                                            className="p-1"
                                            activeOpacity={0.7}
                                            disabled={loadingSales}
                                        >
                                            <Ionicons
                                                name="ellipsis-horizontal"
                                                size={16}
                                                color="#666666"
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                                        {loadingSales ? "..." : stats.totalSales}
                                    </Text>

                                    <Text className="text-xs text-gray-500" style={{ marginTop: 4 }}>
                                        {getSalesTimePeriodLabel()}
                                    </Text>

                                    {loadingSales && (
                                        <View className="absolute top-2 right-8">
                                            <ActivityIndicator size={12} color="#FF9800" />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        <View className="flex-1">
                            <View className="bg-white rounded-xl p-4 border border-gray-200 relative" style={{ height: 120, overflow: 'hidden' }}>
                                <View
                                    className="absolute rounded-full items-center justify-center"
                                    style={{
                                        width: 60,
                                        height: 60,
                                        backgroundColor: '#9C27B015',
                                        bottom: -10,
                                        right: -10
                                    }}
                                >
                                    <Ionicons name="trending-up-outline" size={30} color="#9C27B060" />
                                </View>

                                <View className="flex-1 justify-between relative z-10">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Text className="text-sm font-medium text-gray-700">{tDashboard('revenue')}</Text>
                                        <TouchableOpacity
                                            onPress={() => showPicker('revenue')}
                                            className="p-1"
                                            activeOpacity={0.7}
                                            disabled={loadingRevenue}
                                        >
                                            <Ionicons
                                                name="ellipsis-horizontal"
                                                size={16}
                                                color="#666666"
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <Text className="text-2xl font-bold text-black" style={{ marginTop: 8 }}>
                                        {loadingRevenue ? "..." : `${t('units.rs')} ${stats.netRevenue.toFixed(0)}`}
                                    </Text>

                                    <View style={{ marginTop: 4 }}>
                                        <Text className="text-xs text-gray-500">
                                            {getRevenueTimePeriodLabel()}
                                        </Text>
                                        {!loadingRevenue && (
                                            <Text className="text-xs text-gray-400">
                                                {tDashboard('gross')}: {t('units.rs')} {stats.grossRevenue.toFixed(0)}
                                            </Text>
                                        )}
                                    </View>

                                    {loadingRevenue && (
                                        <View className="absolute top-2 right-8">
                                            <ActivityIndicator size={12} color="#9C27B0" />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <View className="px-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-medium text-black">
                            {tDashboard('myProducts')}
                        </Text>
                        <Text className="text-sm text-gray-500">
                            {filteredProducts.length} {activeTab === 'all' ? tDashboard('total') : tDashboard(activeTab)}
                        </Text>
                    </View>

                    <View className="flex-row mb-6 rounded-lg flex gap-2">
                        <TabButton
                            tab="all"
                            title={tDashboard('total')}
                            isActive={activeTab === 'all'}
                            onPress={() => setActiveTab('all')}
                        />
                        <TabButton
                            tab="fruits"
                            title={tDashboard('fruits')}
                            isActive={activeTab === 'fruits'}
                            onPress={() => setActiveTab('fruits')}
                        />
                        <TabButton
                            tab="vegetables"
                            title={tDashboard('vegetables')}
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

            <FloatingActionButton
                onPress={handleAddProduct}
                icon="add"
            />

            <Modal
                visible={activePicker !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={hidePicker}
            >
                <TouchableWithoutFeedback onPress={hidePicker}>
                    <View
                        className="flex-1 justify-end"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                    >
                        <Animated.View
                            className="bg-white rounded-t-3xl"
                            style={{
                                transform: [{ translateY: slideAnim }],
                                paddingBottom: 40,
                                paddingTop: 20
                            }}
                        >
                            <View className="items-center mb-4">
                                <View
                                    className="bg-gray-300 rounded-full"
                                    style={{ width: 40, height: 4 }}
                                />
                            </View>

                            <View className="px-6 mb-6">
                                <Text className="text-lg font-semibold text-black text-center">
                                    {activePicker === 'sales' ? tDashboard('selectSalesPeriod') : tDashboard('selectRevenuePeriod')}
                                </Text>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{
                                    paddingHorizontal: 20,
                                    paddingVertical: 8
                                }}
                                className="flex-grow-0"
                            >
                                {timePeriodOptions.map((option, index) => {
                                    const isSelected = option.key === getCurrentPeriod();
                                    return (
                                        <TouchableOpacity
                                            key={option.key}
                                            onPress={() => selectPeriod(option.key)}
                                            className={`px-6 py-3 rounded-full mr-3 ${
                                                isSelected
                                                    ? 'bg-background'
                                                    : 'bg-gray-100'
                                            }`}
                                            activeOpacity={0.7}
                                            style={{
                                                minWidth: 80,
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Text className={`text-sm font-medium ${
                                                isSelected ? 'text-black' : 'text-gray-600'
                                            }`}>
                                                {option.short}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <View className="px-6 mt-6">
                                <TouchableOpacity
                                    onPress={hidePicker}
                                    className="bg-gray-200 py-4 rounded-xl"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-center font-medium text-gray-700">
                                        {tDashboard('close')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

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