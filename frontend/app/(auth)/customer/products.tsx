import { useEffect, useState, useContext, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TextInput,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import { useTranslation } from '@/context/LanguageContext';
import Header from '@/components/ui/Header';
import ProductCard from '@/components/customer/ProductCard';
import CustomAlert from '@/components/ui/CustomAlert';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import api from '@/services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface Product {
    id: number;
    item: string;
    category: string;
    description?: string;
    farmer_id: number;
    farmer_name: string;
    farmer_district: string;
    lowest_price: number;
    unit_prices: Array<{
        id: number;
        unit: string;
        customer_type: 'individual' | 'business';
        price_per_unit: number;
        quantity_available: number;
        minimum_order: number;
    }>;
    created_at: string;
}

interface SearchFilters {
    search: string;
    category: string;
    district: string;
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

export default function ProductsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useContext(AuthContext);
    const { tDashboard, tCustomer, tCommon } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [districts, setDistricts] = useState<string[]>([]);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({
        search: '',
        category: '',
        district: ''
    });
    const [pagination, setPagination] = useState({
        offset: 0,
        limit: 20,
        hasMore: true,
        total: 0
    });
    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    const [alert, setAlert] = useState<AlertState>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    const categories = [
        { value: '', label: tCustomer('allCategories') },
        { value: 'fruits', label: tDashboard('fruits') },
        { value: 'vegetables', label: tDashboard('vegetables') }
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

    const handleVoiceResult = (data: any) => {
        if (data?.searchTerm) {
            setSearchText(data.searchTerm);
        }
        if (data?.products) {
            showAlert(
                'success',
                tCustomer('voiceSearch'),
                tCustomer('foundProductsMatching', { count: data.products.length }),
                [{ text: tCommon('ok'), onPress: hideAlert, style: 'cancel' }]
            );
        }
    };

    const debounceSearch = useCallback(
        (() => {
            let timeoutId: number;
            return (searchValue: string) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    setActiveFilters(prev => ({ ...prev, search: searchValue }));
                }, 500);
            };
        })(),
        []
    );

    useEffect(() => {
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }

        if (params.searchTerm) {
            setSearchText(params.searchTerm as string);
        }

        fetchAllDistricts();
        fetchProducts(true);

        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user, params.searchTerm]);

    useEffect(() => {
        if (!loading) {
            fetchProducts(true);
        }
    }, [activeFilters]);

    useEffect(() => {
        debounceSearch(searchText);
    }, [searchText, debounceSearch]);

    const fetchAllDistricts = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const response = await api.get('/browse/districts', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const allDistricts = response.data.map((d: any) => d.district).sort();

            setDistricts(allDistricts);
        } catch (error) {
            console.error('Error fetching districts:', error);
        }
    };

    const buildSearchParams = (isNewSearch: boolean = false) => {
        const params = new URLSearchParams();

        if (activeFilters.search) params.append('search', activeFilters.search);
        if (activeFilters.category) params.append('category', activeFilters.category);
        if (activeFilters.district) params.append('district', activeFilters.district);

        params.append('limit', pagination.limit.toString());
        params.append('offset', isNewSearch ? '0' : pagination.offset.toString());

        return params.toString();
    };

    const fetchProducts = async (isNewSearch: boolean = false) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            if (isNewSearch) {
                setLoading(products.length === 0);
            } else {
                setLoadingMore(true);
            }

            const searchParams = buildSearchParams(isNewSearch);
            const response = await api.get(`/browse/products/search?${searchParams}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const newProducts = response.data.items || [];

            if (isNewSearch) {
                setProducts(newProducts);
                setPagination(prev => ({
                    ...prev,
                    offset: newProducts.length,
                    hasMore: response.data.has_next || false,
                    total: response.data.total || 0
                }));
            } else {
                setProducts(prev => [...prev, ...newProducts]);
                setPagination(prev => ({
                    ...prev,
                    offset: prev.offset + newProducts.length,
                    hasMore: response.data.has_next || false
                }));
            }

        } catch (error: any) {
            console.error('Error fetching products:', error);
            showAlert(
                'error',
                tCommon('error'),
                tCustomer('failedToLoadProducts'),
                [{ text: tCommon('ok'), onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    const handleCategoryFilter = (category: string) => {
        setActiveFilters(prev => ({ ...prev, category }));
        setPagination(prev => ({ ...prev, offset: 0 }));
    };

    const handleDistrictFilter = (district: string) => {
        setActiveFilters(prev => ({ ...prev, district }));
        setPagination(prev => ({ ...prev, offset: 0 }));
    };

    const handleClearFilters = () => {
        setSearchText('');
        setActiveFilters({
            search: '',
            category: '',
            district: ''
        });
        setPagination(prev => ({ ...prev, offset: 0 }));
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAllDistricts();
        fetchProducts(true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && pagination.hasMore) {
            fetchProducts(false);
        }
    };

    const getNumColumns = () => {
        if (screenWidth < 390) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
        const numColumns = getNumColumns();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((products.length - 1) / numColumns);

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

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View className="py-4">
                <ActivityIndicator size="small" color="#4CAF50" />
            </View>
        );
    };

    const CategoryFilter = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18 }}
            className="mb-4"
        >
            {categories.map((category) => (
                <TouchableOpacity
                    key={category.value}
                    onPress={() => handleCategoryFilter(category.value)}
                    className={`mr-3 px-4 py-2 rounded-full ${
                        activeFilters.category === category.value
                            ? 'bg-background'
                            : 'bg-gray-100 border border-gray-100'
                    }`}
                    activeOpacity={0.7}
                >
                    <Text className={`text-sm font-medium ${
                        activeFilters.category === category.value ? 'text-black' : 'text-gray-600'
                    }`}>
                        {category.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const DistrictFilter = () => {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 18 }}
                className="mb-4"
            >
                <TouchableOpacity
                    onPress={() => handleDistrictFilter('')}
                    className={`mr-3 px-4 py-2 rounded-full ${
                        activeFilters.district === ''
                            ? 'bg-background'
                            : 'bg-gray-100 border border-gray-100'
                    }`}
                    activeOpacity={0.7}
                >
                    <Text className={`text-sm font-medium ${
                        activeFilters.district === '' ? 'text-black' : 'text-gray-600'
                    }`}>
                        {tCustomer('allDistricts')}
                    </Text>
                </TouchableOpacity>

                {districts.map((district) => {
                    return (
                        <TouchableOpacity
                            key={district}
                            onPress={() => handleDistrictFilter(district)}
                            className={`mr-3 px-4 py-2 rounded-full ${
                                activeFilters.district === district
                                    ? 'bg-background'
                                    : 'bg-gray-100 border border-gray-100'
                            }`}
                            activeOpacity={0.7}
                        >
                            <Text className={`text-sm font-medium ${
                                activeFilters.district === district ? 'text-black' : 'text-gray-600'
                            }`}>
                                {district.toLowerCase()}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        );
    };

    const EmptyProductsComponent = () => (
        <View className="flex-1 justify-center items-center px-6 py-20">
            <Text className="text-xl font-medium text-black mb-2 text-center">
                {tCustomer('noProductsFound')}
            </Text>
            <Text className="text-gray-600 text-center mb-6">
                {searchText || activeFilters.category || activeFilters.district
                    ? tCustomer('adjustSearchFilters')
                    : tCustomer('noProductsCurrentlyAvailable')
                }
            </Text>
            {(searchText || activeFilters.category || activeFilters.district) && (
                <TouchableOpacity
                    onPress={handleClearFilters}
                    className="bg-background px-6 py-3 rounded-xl"
                    activeOpacity={0.7}
                >
                    <Text className="text-black font-medium">
                        {tCustomer('clearFilters')}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title={tCustomer('products')}
                    showBackButton={true}
                    showCartButton={true}
                    showOrdersButton={true}
                    showHomeButton={true}
                    showNotificationButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{tCustomer('loadingProducts')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title={tCustomer('products')}
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
                    <View className="mb-4">
                        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                            <Ionicons name="search" size={20} color="#666666" />
                            <TextInput
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder={tCustomer('searchProducts')}
                                className="flex-1 ml-3 text-base text-black leading-[1.2]"
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                            {searchText && (
                                <TouchableOpacity
                                    onPress={handleClearFilters}
                                    className="ml-2 p-1"
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="close-circle" size={20} color="#666666" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <View className="flex-row items-center">
                            <Ionicons name="mic" size={16} color="#2563eb" />
                            <Text className="text-blue-700 text-sm font-medium ml-2">
                                {tCustomer('didYouKnow')}
                            </Text>
                        </View>
                        <Text className="text-blue-600 text-xs mt-1">
                            {tCustomer('voiceCommandHint')}
                        </Text>
                    </View>

                    <Text className="text-sm text-gray-600">
                        {pagination.total} {pagination.total === 1 ? tCustomer('productFound') : tCustomer('productsFound')}
                        {activeFilters.search && ` ${tCustomer('forSearch', { search: activeFilters.search })}`}
                        {activeFilters.category && ` ${tCustomer('inCategory', { category: activeFilters.category })}`}
                        {activeFilters.district && ` ${tCustomer('fromDistrict', { district: activeFilters.district })}`}
                    </Text>
                </View>

                <CategoryFilter />

                <DistrictFilter />

                <View className="px-5">
                    {products.length === 0 ? (
                        <EmptyProductsComponent />
                    ) : (
                        <FlatList
                            data={products}
                            renderItem={renderProductItem}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={getNumColumns()}
                            key={getNumColumns()}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                            ListFooterComponent={renderFooter}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.1}
                        />
                    )}
                </View>
            </ScrollView>

            <FloatingActionButton
                showVoice={true}
                onResult={handleVoiceResult}
            />

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