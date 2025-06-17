import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import ProductCard from '@/components/customer/ProductCard';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    unit_prices: Array<{
        id: number;
        unit: string;
        price_per_unit: number;
        quantity_available: number;
        minimum_order: number;
    }>;
    created_at: string;
}

interface FarmerDetails {
    id: number;
    name: string;
    district: string;
    phone: string;
    email: string;
    products: Product[];
    product_count: number;
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

export default function FarmerDetailScreen() {
    const router = useRouter();
    const { farmerId } = useLocalSearchParams();
    const { user } = useContext(AuthContext);
    const [farmer, setFarmer] = useState<FarmerDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<CategoryTab>('all');
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
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
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }

        if (!farmerId) {
            router.back();
            return;
        }

        fetchFarmerDetails();

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user, farmerId]);

    const fetchFarmerDetails = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get(`/browse/farmer/${farmerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFarmer(response.data);

        } catch (error: any) {
            console.error('Error fetching farmer details:', error);
            showAlert(
                'error',
                'error',
                'failed to load farmer details',
                [{ text: 'ok', onPress: () => router.back(), style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchFarmerDetails();
    };

    const handleAddToCart = async (product: Product, unitPriceId: number, quantity: number) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            await api.post('/orders/cart/items', {
                farmer_product_id: product.id,
                unit_price_id: unitPriceId,
                quantity: quantity
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert(
                'success',
                'success',
                'item added to cart successfully',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );

        } catch (error: any) {
            console.error('Error adding to cart:', error);
            showAlert(
                'error',
                'error',
                error.response?.data?.detail || 'failed to add item to cart',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        }
    };

    const formatItemName = (item: string) => {
        return item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toLowerCase());
    };

    const getFilteredProducts = () => {
        if (!farmer?.products) return [];

        if (activeTab === 'all') return farmer.products;
        if (activeTab === 'fruits') {
            return farmer.products.filter(product => fruitItems.has(product.item));
        }
        if (activeTab === 'vegetables') {
            return farmer.products.filter(product => !fruitItems.has(product.item));
        }
        return farmer.products;
    };

    const getNumColumns = () => {
        if (screenWidth < 400) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const filteredProducts = getFilteredProducts();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((filteredProducts.length - 1) / numColumns);

        // Transform product to match expected interface
        const transformedProduct = {
            ...item,
            farmer_id: farmer!.id,
            farmer_name: farmer!.name,
            farmer_district: farmer!.district,
            lowest_price: Math.min(...item.unit_prices.map(up => up.price_per_unit))
        };

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
                    product={transformedProduct}
                    onAddToCart={handleAddToCart}
                    formatItemName={formatItemName}
                />
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

    const EmptyProductsComponent = ({ category }: { category: CategoryTab }) => {
        const getEmptyMessage = () => {
            switch (category) {
                case 'fruits':
                    return {
                        emoji: '🍎',
                        title: 'no fruits available',
                        subtitle: `${farmer?.name} doesn't have any fruits listed currently`
                    };
                case 'vegetables':
                    return {
                        emoji: '🥕',
                        title: 'no vegetables available',
                        subtitle: `${farmer?.name} doesn't have any vegetables listed currently`
                    };
                default:
                    return {
                        emoji: '🌱',
                        title: 'no products available',
                        subtitle: `${farmer?.name} doesn't have any products listed currently`
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

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="farmer details"
                    showBackButton={true}
                    showCartButton={true}
                    onCartPress={() => router.push('/customer/cart')}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading farmer details...</Text>
                </View>
            </View>
        );
    }

    if (!farmer) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="farmer details"
                    showBackButton={true}
                    showCartButton={true}
                    onCartPress={() => router.push('/customer/cart')}
                />
                <View className="flex-1 justify-center items-center px-6">
                    <Text className="text-4xl mb-4">😞</Text>
                    <Text className="text-xl font-medium text-black mb-2 text-center">
                        farmer not found
                    </Text>
                    <Text className="text-gray-600 text-center">
                        the farmer you&#39;re looking for is not available
                    </Text>
                </View>
            </View>
        );
    }

    const filteredProducts = getFilteredProducts();

    return (
        <View className="flex-1 bg-surface">
            <Header
                title={farmer.name.toLowerCase()}
                showBackButton={true}
                showCartButton={true}
                onCartPress={() => router.push('/customer/cart')}
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
                {/* Farmer Profile Section */}
                <View className="px-5 pt-6 pb-4">
                    <View className="bg-background rounded-xl p-6 flex-row justify-between">
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="location" size={18} color="#000000" />
                            <Text className="text-base text-gray-600">
                                {farmer.district}
                            </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                            <Ionicons name="call" size={18} color="#000000" />
                            <Text className="text-base text-gray-600">
                                {farmer.phone}
                            </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                            <Ionicons name="leaf" size={18} color="#000000" />
                            <Text className="text-base text-gray-600">
                                {farmer.product_count} products
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Products Section */}
                <View className="px-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-medium text-black">
                            available products
                        </Text>
                        <Text className="text-sm text-gray-500">
                            {filteredProducts.length} {activeTab === 'all' ? 'total' : activeTab}
                        </Text>
                    </View>

                    {/* Tab Navigation */}
                    <View className="flex-row mb-6 rounded-lg gap-2">
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

                    {/* Products Grid */}
                    {filteredProducts.length === 0 ? (
                        <EmptyProductsComponent category={activeTab} />
                    ) : (
                        <FlatList
                            data={filteredProducts}
                            renderItem={renderProductItem}
                            numColumns={getNumColumns()}
                            key={`${getNumColumns()}-${activeTab}`}
                            scrollEnabled={false}
                            contentContainerStyle={{ paddingHorizontal: 0 }}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </ScrollView>

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