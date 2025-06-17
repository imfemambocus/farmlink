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
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UnitPrice {
    id: number;
    unit: string;
    price_per_unit: number;
    quantity_available: number;
    minimum_order: number;
}

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
    totalRevenue: number;
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

export default function FarmerDashboard() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalProducts: 0,
        activeProducts: 0,
        totalSales: 0,
        totalRevenue: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    const [activeTab, setActiveTab] = useState<CategoryTab>('all');
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
    }, [user]);

    // Calculate number of columns based on screen width
    const getNumColumns = () => {
        if (screenWidth < 400) return 1; // Very small screens (phones in portrait)
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
            const response = await api.get('/products/my', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setProducts(response.data);

            // Calculate stats from products
            const totalProducts = response.data.length;
            const activeProducts = response.data.filter((p: Product) => p.is_active).length;

            // For now, mock sales and revenue data
            // In a real app, you'd fetch this from orders/sales endpoints
            setStats({
                totalProducts,
                activeProducts,
                totalSales: Math.floor(Math.random() * 50), // Mock data
                totalRevenue: Math.floor(Math.random() * 10000) // Mock data
            });

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            showAlert(
                'error',
                'error',
                'failed to load dashboard data',
                [{ text: 'ok', onPress: () => {}, style: 'cancel' }]
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
                [{ text: 'ok', onPress: () => {}, style: 'cancel' }]
            );

        } catch (error: any) {
            console.error('Error updating product status:', error);
            showAlert(
                'error',
                'error',
                'failed to update product status',
                [{ text: 'ok', onPress: () => {}, style: 'cancel' }]
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

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const filteredProducts = getFilteredProducts();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((filteredProducts.length - 1) / numColumns);

        return (
            <View
                style={{
                    flex: 1,
                    marginBottom: isLastRow ? 0 : 12,
                    marginHorizontal: 6,
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
                <Header title="dashboard" showSettingsButton={true} />
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
            <Header title="dashboard" showSettingsButton={true} />

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
                <View className="px-6 pt-6 pb-4">
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
                        <StatCard
                            title="total sales"
                            value={stats.totalSales}
                            icon="bag-handle-outline"
                            color="#FF9800"
                            subtitle="this month"
                        />
                        <StatCard
                            title="revenue"
                            value={`rs ${stats.totalRevenue}`}
                            icon="trending-up-outline"
                            color="#9C27B0"
                            subtitle="this month"
                        />
                    </View>
                </View>

                {/* Products Section */}
                <View className="px-6">
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