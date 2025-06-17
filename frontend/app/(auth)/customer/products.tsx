import { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TextInput,
    TouchableOpacity,
    Dimensions,
    Modal
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
    minPrice: string;
    maxPrice: string;
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
    { value: '', label: 'All Categories' },
    { value: 'fruits', label: 'Fruits' },
    { value: 'vegetables', label: 'Vegetables' }
];

export default function ProductsScreen() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({
        search: '',
        category: '',
        district: '',
        minPrice: '',
        maxPrice: ''
    });
    const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
        search: '',
        category: '',
        district: '',
        minPrice: '',
        maxPrice: ''
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

    useEffect(() => {
        if (user?.role !== 'individual' && user?.role !== 'business') {
            router.replace('/(auth)');
            return;
        }

        fetchProducts(true);

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    const buildSearchParams = (isNewSearch: boolean = false) => {
        const params = new URLSearchParams();

        if (appliedFilters.search) params.append('search', appliedFilters.search);
        if (appliedFilters.category) params.append('category', appliedFilters.category);
        if (appliedFilters.district) params.append('district', appliedFilters.district);
        if (appliedFilters.minPrice) params.append('min_price', appliedFilters.minPrice);
        if (appliedFilters.maxPrice) params.append('max_price', appliedFilters.maxPrice);

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
                setLoading(true);
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

    const handleSearch = () => {
        setAppliedFilters({ ...filters, search: searchText });
        setPagination(prev => ({ ...prev, offset: 0 }));
        setTimeout(() => fetchProducts(true), 100);
    };

    const handleApplyFilters = () => {
        setAppliedFilters({ ...filters });
        setPagination(prev => ({ ...prev, offset: 0 }));
        setShowFilters(false);
        setTimeout(() => fetchProducts(true), 100);
    };

    const handleClearFilters = () => {
        const clearedFilters = {
            search: '',
            category: '',
            district: '',
            minPrice: '',
            maxPrice: ''
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSearchText('');
        setPagination(prev => ({ ...prev, offset: 0 }));
        setTimeout(() => fetchProducts(true), 100);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchProducts(true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && pagination.hasMore) {
            fetchProducts(false);
        }
    };

    const handleProductPress = (product: Product) => {
        router.push(`/customer/product/${product.id}`);
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

    const getNumColumns = () => {
        if (screenWidth < 400) return 1;
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
                    marginHorizontal: 6,
                    maxWidth: `${100 / numColumns - 2}%`
                }}
            >
                <ProductCard
                    product={item}
                    onPress={() => handleProductPress(item)}
                    onAddToCart={handleAddToCart}
                    formatItemName={formatItemName}
                />
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

    const getActiveFilterCount = () => {
        return Object.values(appliedFilters).filter(value => value !== '').length;
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <Header
                    title="products"
                    showBackButton={true}
                    showCartButton={true}
                    onCartPress={() => router.push('/customer/cart')}
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
                onCartPress={() => router.push('/customer/cart')}
            />

            {/* Search and Filter Bar */}
            <View className="px-6 pt-6 pb-4">
                <View className="flex-row items-center mb-4">
                    <View className="flex-1 flex-row items-center bg-background rounded-xl px-4 py-3 mr-3">
                        <Ionicons name="search" size={20} color="#666666" />
                        <TextInput
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="search products..."
                            className="flex-1 ml-3 text-base text-black"
                            onSubmitEditing={handleSearch}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={() => setShowFilters(true)}
                        className="bg-background p-3 rounded-xl relative"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="filter" size={20} color="#000" />
                        {getActiveFilterCount() > 0 && (
                            <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                                <Text className="text-xs text-white font-medium">
                                    {getActiveFilterCount()}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Results Summary */}
                <Text className="text-sm text-gray-600">
                    {pagination.total} product{pagination.total !== 1 ? 's' : ''} found
                    {appliedFilters.search && ` for "${appliedFilters.search}"`}
                </Text>
            </View>

            {/* Products List */}
            {products.length === 0 ? (
                <View className="flex-1 justify-center items-center px-6">
                    <Text className="text-4xl mb-4">🔍</Text>
                    <Text className="text-xl font-medium text-black mb-2 text-center">
                        no products found
                    </Text>
                    <Text className="text-gray-600 text-center mb-6">
                        try adjusting your search or filters
                    </Text>
                    <TouchableOpacity
                        onPress={handleClearFilters}
                        className="bg-action-green px-6 py-3 rounded-xl"
                        activeOpacity={0.7}
                    >
                        <Text className="text-white font-medium">
                            clear filters
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={products}
                    renderItem={renderProductItem}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={getNumColumns()}
                    key={getNumColumns()}
                    contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#4CAF50']}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.1}
                    ListFooterComponent={renderFooter}
                />
            )}

            {/* Filter Modal */}
            <Modal
                visible={showFilters}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <View className="flex-1 bg-surface">
                    <View className="flex-row justify-between items-center p-6 border-b border-gray-200">
                        <Text className="text-xl font-medium text-black">filters</Text>
                        <TouchableOpacity
                            onPress={() => setShowFilters(false)}
                            className="p-2"
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
                        {/* Category Filter */}
                        <View className="mb-6">
                            <Text className="text-base font-medium text-black mb-3">category</Text>
                            {categories.map((category) => (
                                <TouchableOpacity
                                    key={category.value}
                                    onPress={() => setFilters(prev => ({ ...prev, category: category.value }))}
                                    className={`flex-row items-center p-3 rounded-xl mb-2 ${
                                        filters.category === category.value
                                            ? 'bg-light-100 border border-action-green'
                                            : 'bg-background'
                                    }`}
                                    activeOpacity={0.7}
                                >
                                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${
                                        filters.category === category.value
                                            ? 'border-action-green'
                                            : 'border-gray-300'
                                    }`}>
                                        {filters.category === category.value && (
                                            <View className="w-2.5 h-2.5 rounded-full bg-action-green" />
                                        )}
                                    </View>
                                    <Text className={`text-base ${
                                        filters.category === category.value ? 'text-action-green font-medium' : 'text-black'
                                    }`}>
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* District Filter */}
                        <View className="mb-6">
                            <Text className="text-base font-medium text-black mb-3">district</Text>
                            <View className="bg-background rounded-xl p-4">
                                <TextInput
                                    value={filters.district}
                                    onChangeText={(text) => setFilters(prev => ({ ...prev, district: text }))}
                                    placeholder="enter district name..."
                                    className="text-base text-black"
                                />
                            </View>
                        </View>

                        {/* Price Range Filter */}
                        <View className="mb-6">
                            <Text className="text-base font-medium text-black mb-3">price range (rs)</Text>
                            <View className="flex-row items-center">
                                <View className="flex-1 bg-background rounded-xl p-4 mr-3">
                                    <TextInput
                                        value={filters.minPrice}
                                        onChangeText={(text) => setFilters(prev => ({ ...prev, minPrice: text }))}
                                        placeholder="min price"
                                        keyboardType="numeric"
                                        className="text-base text-black"
                                    />
                                </View>
                                <Text className="text-gray-600 mx-2">to</Text>
                                <View className="flex-1 bg-background rounded-xl p-4 ml-3">
                                    <TextInput
                                        value={filters.maxPrice}
                                        onChangeText={(text) => setFilters(prev => ({ ...prev, maxPrice: text }))}
                                        placeholder="max price"
                                        keyboardType="numeric"
                                        className="text-base text-black"
                                    />
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Filter Actions */}
                    <View className="p-6 border-t border-gray-200">
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={handleClearFilters}
                                className="flex-1 py-4 bg-gray-200 rounded-xl"
                                activeOpacity={0.7}
                            >
                                <Text className="text-center font-medium text-black">
                                    clear all
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleApplyFilters}
                                className="flex-1 py-4 bg-action-green rounded-xl"
                                activeOpacity={0.7}
                            >
                                <Text className="text-center font-medium text-white">
                                    apply filters
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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