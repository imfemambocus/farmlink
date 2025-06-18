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
import { useRouter } from 'expo-router';
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

const categories = [
    { value: '', label: 'all categories' },
    { value: 'fruits', label: 'fruits' },
    { value: 'vegetables', label: 'vegetables' }
];

export default function ProductsScreen() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
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

    // Debounce search function
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

        // Load initial data
        fetchAllDistricts();
        fetchProducts(true);

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    // Trigger search when activeFilters change
    useEffect(() => {
        if (!loading) {
            fetchProducts(true);
        }
    }, [activeFilters]);

    // Handle search text changes with debouncing
    useEffect(() => {
        debounceSearch(searchText);
    }, [searchText, debounceSearch]);

    // NEW: Fetch all districts separately to keep them persistent
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
                setLoading(products.length === 0); // Only show loading spinner on initial load
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
                'error',
                'failed to load products',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
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
        // FIXED: Also refresh districts on pull-to-refresh
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
                        all districts
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
                no products found
            </Text>
            <Text className="text-gray-600 text-center mb-6">
                {searchText || activeFilters.category || activeFilters.district
                    ? 'try adjusting your search or filters'
                    : 'no products are currently available'
                }
            </Text>
            {(searchText || activeFilters.category || activeFilters.district) && (
                <TouchableOpacity
                    onPress={handleClearFilters}
                    className="bg-action-green px-6 py-3 rounded-xl"
                    activeOpacity={0.7}
                >
                    <Text className="text-white font-medium">
                        clear filters
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="products"
                    showBackButton={true}
                    showCartButton={true}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading products...</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="products"
                showBackButton={true}
                showCartButton={true}
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
                {/* Search Bar */}
                <View className="px-5 pt-6 pb-4">
                    <View className="mb-4">
                        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                            <Ionicons name="search" size={20} color="#666666" />
                            <TextInput
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder="search products..."
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

                    {/* Results Summary */}
                    <Text className="text-sm text-gray-600">
                        {pagination.total} product{pagination.total !== 1 ? 's' : ''} found
                        {activeFilters.search && ` for "${activeFilters.search}"`}
                        {activeFilters.category && ` in ${activeFilters.category}`}
                        {activeFilters.district && ` from ${activeFilters.district}`}
                    </Text>
                </View>

                {/* Category Filter */}
                <CategoryFilter />

                {/* District Filter */}
                <DistrictFilter />

                {/* Products Grid */}
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