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
import { useTranslation } from '@/context/LanguageContext';
import Header from '@/components/ui/Header';
import ProductCard from '@/components/customer/ProductCard';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {AlertState, UnitPrice} from "@/types";

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    unit_prices: UnitPrice[];
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

type CategoryTab = 'all' | 'fruits' | 'vegetables';

export default function FarmerDetailScreen() {
    const router = useRouter();
    const { farmerId } = useLocalSearchParams();
    const { user } = useContext(AuthContext);
    const { t, tCommon } = useTranslation();
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
                tCommon('error'),
                t('farmers.failedToLoadFarmer'),
                [{ text: tCommon('ok'), onPress: () => router.back(), style: 'cancel' }]
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
        if (screenWidth < 390) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const filteredProducts = getFilteredProducts();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((filteredProducts.length - 1) / numColumns);

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
                <ProductCard product={transformedProduct} />
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
                        title: t('farmers.noFruitsAvailable'),
                        subtitle: `${farmer?.name} ${t('farmers.noFruitsListed')}`
                    };
                case 'vegetables':
                    return {
                        emoji: '🥕',
                        title: t('farmers.noVegetablesAvailable'),
                        subtitle: `${farmer?.name} ${t('farmers.noVegetablesListed')}`
                    };
                default:
                    return {
                        emoji: '🌱',
                        title: t('farmers.noProductsAvailable'),
                        subtitle: `${farmer?.name} ${t('farmers.noProductsListed')}`
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
                    title={t('farmers.farmerDetails')}
                    showBackButton={true}
                    showCartButton={true}
                    showHomeButton={true}
                    showNotificationButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{t('farmers.loadingFarmerDetails')}</Text>
                </View>
            </View>
        );
    }

    if (!farmer) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title={t('farmers.farmerDetails')}
                    showBackButton={true}
                    showCartButton={true}
                    showHomeButton={true}
                    showNotificationButton={true}
                />
                <View className="flex-1 justify-center items-center px-6">
                    <Text className="text-4xl mb-4">😞</Text>
                    <Text className="text-xl font-medium text-black mb-2 text-center">
                        {t('farmers.farmerNotFound')}
                    </Text>
                    <Text className="text-gray-600 text-center">
                        {t('farmers.farmerNotAvailable')}
                    </Text>
                </View>
            </View>
        );
    }

    const filteredProducts = getFilteredProducts();

    return (
        <View className="flex-1 bg-surface">
            <Header
                title={farmer.name}
                showBackButton={true}
                showCartButton={true}
                showOrdersButton={true}
                showHomeButton={true}
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
                    <View className="bg-background rounded-xl py-6 px-4 flex-row gap-2 justify-between">
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
                                {farmer.product_count} {t('farmers.products')}
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="px-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-medium text-black">
                            {t('farmers.availableProducts')}
                        </Text>
                        <Text className="text-sm text-gray-500">
                            {filteredProducts.length} {activeTab === 'all' ? t('farmers.total') : t(`farmers.${activeTab}`)}
                        </Text>
                    </View>

                    <View className="flex-row mb-6 rounded-lg gap-2">
                        <TabButton
                            tab="all"
                            title={t('farmers.all')}
                            isActive={activeTab === 'all'}
                            onPress={() => setActiveTab('all')}
                        />
                        <TabButton
                            tab="fruits"
                            title={t('farmers.fruits')}
                            isActive={activeTab === 'fruits'}
                            onPress={() => setActiveTab('fruits')}
                        />
                        <TabButton
                            tab="vegetables"
                            title={t('farmers.vegetables')}
                            isActive={activeTab === 'vegetables'}
                            onPress={() => setActiveTab('vegetables')}
                        />
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
                            contentContainerStyle={{ paddingHorizontal: 0 }}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </ScrollView>

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