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
    Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '@/context/AuthContext';
import Header from '@/components/ui/Header';
import FarmerCard from '@/components/customer/FarmerCard';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface Farmer {
    id: number;
    name: string;
    district: string;
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

export default function FarmersScreen() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [filteredFarmers, setFilteredFarmers] = useState<Farmer[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('');
    const [districts, setDistricts] = useState<string[]>([]);
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

        fetchFarmers();

        // Listen for screen dimension changes
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    useEffect(() => {
        // Filter farmers when search text or district changes
        filterFarmers();
    }, [searchText, selectedDistrict, farmers]);

    const fetchFarmers = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            // Fetch all farmers (increased limit to get more farmers)
            const response = await api.get('/browse/farmers?limit=50', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFarmers(response.data);

            // Extract unique districts for filtering
            const uniqueDistricts = [...new Set(response.data.map((farmer: Farmer) => farmer.district))];
            // @ts-ignore
            setDistricts(uniqueDistricts.sort());

        } catch (error: any) {
            console.error('Error fetching farmers:', error);
            showAlert(
                'error',
                'error',
                'failed to load farmers',
                [{ text: 'ok', onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterFarmers = () => {
        let filtered = farmers;

        // Filter by search text (name or district)
        if (searchText.trim()) {
            const searchLower = searchText.toLowerCase();
            filtered = filtered.filter(farmer =>
                farmer.name.toLowerCase().includes(searchLower) ||
                farmer.district.toLowerCase().includes(searchLower)
            );
        }

        // Filter by selected district
        if (selectedDistrict) {
            filtered = filtered.filter(farmer => farmer.district === selectedDistrict);
        }

        setFilteredFarmers(filtered);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchFarmers();
    };

    const handleFarmerPress = (farmer: Farmer) => {
        router.push(`/customer/farmers/${farmer.id}`);
    };

    const handleClearFilters = () => {
        setSearchText('');
        setSelectedDistrict('');
    };

    const getNumColumns = () => {
        if (screenWidth < 400) return 1;
        if (screenWidth < 768) return 2;
        return 3;
    };

    const renderFarmerItem = ({ item, index }: { item: Farmer; index: number }) => {
        const numColumns = getNumColumns();
        const isLastRow = Math.floor(index / numColumns) === Math.floor((filteredFarmers.length - 1) / numColumns);

        return (
            <View
                style={{
                    flex: 1,
                    marginBottom: isLastRow ? 0 : 12,
                    marginHorizontal: 6,
                    maxWidth: `${100 / numColumns - 2}%`
                }}
            >
                <FarmerCard
                    farmer={item}
                    onPress={() => handleFarmerPress(item)}
                    variant="vertical"
                />
            </View>
        );
    };

    const DistrictFilter = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 24 }}
            className="mb-4"
        >
            <TouchableOpacity
                onPress={() => setSelectedDistrict('')}
                className={`mr-3 px-4 py-2 rounded-full ${
                    selectedDistrict === ''
                        ? 'bg-background'
                        : 'bg-gray-100 border border-gray-100'
                }`}
                activeOpacity={0.7}
            >
                <Text className={`text-sm font-medium ${
                    selectedDistrict === '' ? 'text-black' : 'text-gray-600'
                }`}>
                    all districts
                </Text>
            </TouchableOpacity>

            {districts.map((district) => (
                <TouchableOpacity
                    key={district}
                    onPress={() => setSelectedDistrict(district)}
                    className={`mr-3 px-4 py-2 rounded-full ${
                        selectedDistrict === district
                            ? 'bg-background'
                            : 'bg-gray-100 border border-gray-100'
                    }`}
                    activeOpacity={0.7}
                >
                    <Text className={`text-sm font-medium ${
                        selectedDistrict === district ? 'text-black' : 'text-gray-600'
                    }`}>
                        {district.toLowerCase()}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const EmptyFarmersComponent = () => (
        <View className="flex-1 justify-center items-center px-6">
            <Text className="text-6xl mb-4">👨‍🌾</Text>
            <Text className="text-xl font-medium text-black mb-2 text-center">
                no farmers found
            </Text>
            <Text className="text-gray-600 text-center mb-6">
                {searchText || selectedDistrict
                    ? 'try adjusting your search or filters'
                    : 'no farmers are currently available in your area'
                }
            </Text>
            {(searchText || selectedDistrict) && (
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
                    title="farmers"
                    showBackButton={true}
                    showCartButton={true}
                    onCartPress={() => router.push('/customer/cart')}
                />
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">loading farmers...</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="farmers"
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
                stickyHeaderIndices={[0]}
            >
                {/* Search and Filter Header */}
                <View className="bg-surface pb-4">
                    {/* Search Bar */}
                    <View className="px-6 pt-6 pb-4">
                        <View className="mb-4">
                            <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                                <Ionicons name="search" size={20} color="#666666" />
                                <TextInput
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    placeholder="search farmers or districts..."
                                    className="flex-1 ml-3 text-base text-black"
                                    style={{ textAlignVertical: 'center' }}
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
                            {filteredFarmers.length} farmer{filteredFarmers.length !== 1 ? 's' : ''} found
                            {selectedDistrict && ` in ${selectedDistrict}`}
                        </Text>
                    </View>

                    {/* District Filter */}
                    <DistrictFilter />
                </View>

                {/* Farmers Grid */}
                <View className="px-6">
                    {filteredFarmers.length === 0 ? (
                        <EmptyFarmersComponent />
                    ) : (
                        <FlatList
                            data={filteredFarmers}
                            renderItem={renderFarmerItem}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={getNumColumns()}
                            key={getNumColumns()}
                            scrollEnabled={false}
                            contentContainerStyle={{ paddingBottom: 100 }}
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