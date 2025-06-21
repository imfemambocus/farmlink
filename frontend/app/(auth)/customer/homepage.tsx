// app/(auth)/customer/homepage.tsx - Updated with Suggested For You section
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
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import FarmerCard from '@/components/customer/FarmerCard';
import ProductCard from '@/components/customer/ProductCard';
import CustomAlert from '@/components/ui/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {UnitPrice} from "@/types";

interface Farmer {
    id: number;
    name: string;
    district: string;
    product_count: number;
}

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    lowest_price: number;
    unit_prices: UnitPrice[];
    created_at: string;
}

interface RecommendationData {
    recommendations: Product[];
    has_purchase_history: boolean;
    total_recommendations: number;
    message: string;
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

export default function CustomerHomePage() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [latestProducts, setLatestProducts] = useState<Product[]>([]);
    const [recommendations, setRecommendations] = useState<RecommendationData>({
        recommendations: [],
        has_purchase_history: false,
        total_recommendations: 0,
        message: ''
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

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
        fetchHomeData();

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    const fetchHomeData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            // Fetch farmers, latest products, and recommendations in parallel
            const [farmersResponse, productsResponse, recommendationsResponse] = await Promise.all([
                api.get('/browse/farmers?limit=10', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                api.get('/browse/products/latest?limit=20', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                api.get('/browse/products/recommendations', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setFarmers(farmersResponse.data);

            // Filter products that have pricing for the current user type
            const userRole = user?.role || 'individual';
            const filteredProducts = productsResponse.data.filter((product: Product) => {
                const customerType = userRole as 'individual' | 'business';
                return product.unit_prices.some(up => up.customer_type === customerType);
            });

            setLatestProducts(filteredProducts);
            setRecommendations(recommendationsResponse.data);

        } catch (error: any) {
            console.error('Error fetching home data:', error);
            showAlert(
                'error',
                'error',
                'failed to load homepage data',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchHomeData();
    };

    const handleFarmerPress = (farmer: Farmer) => {
        router.push(`/customer/farmers/${farmer.id}`);
    };

    const handleViewAllProducts = () => {
        router.push('/customer/products');
    };

    const getNumColumns = () => {
        if (screenWidth < 390) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

    const renderFarmerItem = ({ item }: { item: Farmer }) => (
        <FarmerCard
            farmer={item}
            onPress={() => handleFarmerPress(item)}
        />
    );

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((latestProducts.length - 1) / numColumns);

        return (
            <View
                style={{
                    flex: 1,
                    marginBottom: isLastRow ? 0 : 12,
                    marginHorizontal: 4,
                    maxWidth: `${100 / numColumns - 2}%`
                }}
            >
                <ProductCard product={item} />
            </View>
        );
    };

    const renderRecommendationItem = ({ item }: { item: Product }) => (
        <View style={{ width: screenWidth * 0.45, marginRight: 12 }}>
            <ProductCard product={item} />
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="farmlink"
                    showCartButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading homepage...</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="farmlink"
                showCartButton={true}
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
                        welcome back, {user?.individual_profile?.first_name?.toLowerCase() ||
                        user?.business_profile?.contact_name?.toLowerCase() || 'there'}!
                    </Text>
                    <Text className="text-base text-gray-600">
                        discover fresh produce from local farmers
                        {user?.role === 'business' && ' with bulk pricing'}
                    </Text>
                </View>

                {/* Suggested For You Section */}
                <View className="mb-8">
                    <View className="flex-row justify-between items-center px-5 mb-4">
                        <View className="flex-row items-center">
                            <Ionicons name="sparkles" size={20} color="#4CAF50" />
                            <Text className="text-lg font-medium text-black ml-2">
                                suggested for you
                            </Text>
                        </View>
                        {recommendations.has_purchase_history && recommendations.recommendations.length > 0 && (
                            <TouchableOpacity
                                onPress={handleViewAllProducts}
                                activeOpacity={0.7}
                            >
                                <Text className="text-sm text-action-green font-medium">
                                    explore more
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {recommendations.recommendations.length === 0 ? (
                        <View className="bg-surface rounded-xl p-6 mx-5 border border-gray-100">
                            <View className="items-center">
                                <View className="w-16 h-16 bg-green-50 rounded-full items-center justify-center mb-4">
                                    <Ionicons name="bulb" size={32} color="#4CAF50" />
                                </View>
                                <Text className="text-base font-medium text-black mb-2 text-center">
                                    your personalized picks await
                                </Text>
                                <Text className="text-sm text-gray-600 text-center leading-5">
                                    {recommendations.message}
                                </Text>
                                <TouchableOpacity
                                    onPress={handleViewAllProducts}
                                    className="bg-action-green px-6 py-3 rounded-xl mt-4"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-white font-medium">
                                        start exploring
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View>
                            <Text className="text-sm text-gray-600 mb-4 px-5">
                                {recommendations.message}
                            </Text>
                            <FlatList
                                data={recommendations.recommendations}
                                renderItem={({ item }) => (
                                    <View style={{ width: screenWidth * 0.45, marginRight: 12 }}>
                                        <ProductCard product={item} />
                                    </View>
                                )}
                                keyExtractor={(item) => item.id.toString()}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 20 }}
                            />
                        </View>
                    )}
                </View>

                {/* Featured Farmers Section */}
                <View className="mb-8">
                    <View className="flex-row justify-between items-center px-5 mb-4">
                        <Text className="text-lg font-medium text-black">
                            featured farmers
                        </Text>
                        <TouchableOpacity
                            onPress={() => router.push('/customer/farmers')}
                            activeOpacity={0.7}
                        >
                            <Text className="text-sm text-action-green font-medium">
                                view all
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {farmers.length === 0 ? (
                        <View className="bg-surface rounded-xl p-8 items-center mx-6">
                            <Text className="text-4xl mb-4">👨‍🌾</Text>
                            <Text className="text-lg font-medium text-black mb-2">
                                no farmers available
                            </Text>
                            <Text className="text-gray-600 text-center">
                                check back later for featured farmers in your area
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={farmers}
                            renderItem={renderFarmerItem}
                            keyExtractor={(item) => item.id.toString()}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20 }}
                            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                        />
                    )}
                </View>

                {/* Fresh Arrivals Section */}
                <View className="px-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-medium text-black">
                            fresh arrivals
                        </Text>
                        <TouchableOpacity
                            onPress={handleViewAllProducts}
                            activeOpacity={0.7}
                        >
                            <Text className="text-sm text-action-green font-medium">
                                view all
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {latestProducts.length === 0 ? (
                        <View className="bg-surface rounded-xl p-8 items-center">
                            <Text className="text-lg font-medium text-black mb-2">
                                {user?.role === 'business'
                                    ? 'no bulk products available'
                                    : 'no products available'
                                }
                            </Text>
                            <Text className="text-gray-600 text-center">
                                {user?.role === 'business'
                                    ? 'farmers are working to add bulk pricing options soon'
                                    : 'farmers are working hard to bring fresh produce soon'
                                }
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={latestProducts}
                            renderItem={renderProductItem}
                            numColumns={getNumColumns()}
                            key={`latest-${getNumColumns()}`}
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