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
import { useTranslation } from '@/context/LanguageContext';
import Header from '@/components/ui/Header';
import FarmerCard from '@/components/customer/FarmerCard';
import CustomAlert from '@/components/ui/CustomAlert';
import api from '@/services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {AlertState} from "@/types";

interface Farmer {
    id: number;
    name: string;
    district: string;
    product_count: number;
}

export default function FarmersScreen() {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const { t, tCommon } = useTranslation();
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

        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenWidth(window.width);
        });

        return () => subscription?.remove();
    }, [user]);

    useEffect(() => {
        filterFarmers();
    }, [searchText, selectedDistrict, farmers]);

    const fetchFarmers = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                router.replace('/login');
                return;
            }

            const response = await api.get('/browse/farmers?limit=50', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFarmers(response.data);

            const uniqueDistricts = [...new Set(response.data.map((farmer: Farmer) => farmer.district))];
            // @ts-ignore
            setDistricts(uniqueDistricts.sort());

        } catch (error: any) {
            console.error('Error fetching farmers:', error);
            showAlert(
                'error',
                tCommon('error'),
                t('farmers.failedToLoadFarmers'),
                [{ text: tCommon('ok'), onPress: hideAlert, style: 'cancel' }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterFarmers = () => {
        let filtered = farmers;

        if (searchText.trim()) {
            const searchLower = searchText.toLowerCase();
            filtered = filtered.filter(farmer =>
                farmer.name.toLowerCase().includes(searchLower) ||
                farmer.district.toLowerCase().includes(searchLower)
            );
        }

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
        if (screenWidth < 390) return 1;
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
                    marginHorizontal: 4,
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
            contentContainerStyle={{ paddingHorizontal: 18 }}
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
                    {t('farmers.allDistricts')}
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
                        {district}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const EmptyFarmersComponent = () => (
        <View className="flex-1 justify-center items-center px-6 py-20">
            <Text className="text-xl font-medium text-black mb-2 text-center">
                {t('farmers.noFarmersFound')}
            </Text>
            <Text className="text-gray-600 text-center mb-6">
                {searchText || selectedDistrict
                    ? t('farmers.adjustSearchFilters')
                    : t('farmers.noFarmersAvailable')
                }
            </Text>
            {(searchText || selectedDistrict) && (
                <TouchableOpacity
                    onPress={handleClearFilters}
                    className="bg-black px-6 py-3 rounded-xl"
                    activeOpacity={0.7}
                >
                    <Text className="text-white font-medium">
                        {t('farmers.clearFilters')}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-surface">
                <View className="absolute top-0 left-0 right-0 z-10">
                    <Header
                        title={t('farmers.farmersTitle')}
                        showBackButton={true}
                        showCartButton={true}
                        showOrdersButton={true}
                    />
                </View>
                <View
                    className="flex-1 justify-center items-center"
                    style={{ paddingTop: Dimensions.get('window').height * 0.2 }}
                >
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text className="text-gray-600 mt-4">{t('farmers.loadingFarmers')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <View className="absolute top-0 left-0 right-0 z-10">
                <Header
                    title={t('farmers.farmersTitle')}
                    showBackButton={true}
                    showCartButton={true}
                    showOrdersButton={true}
                />
            </View>

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
                contentContainerStyle={{
                    paddingTop: Dimensions.get('window').height * 0.2,
                    paddingBottom: 100
                }}
            >
                <View className="px-5 pt-6 pb-4">
                    <View className="mb-4">
                        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                            <Ionicons name="search" size={20} color="#666666" />
                            <TextInput
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder={t('farmers.searchFarmersDistricts')}
                                placeholderTextColor="#CCCCCC"
                                className="flex-1 ml-3 text-base text-black"
                                style={{ textAlignVertical: 'center' }}
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

                    <Text className="text-sm text-gray-600">
                        {filteredFarmers.length} {filteredFarmers.length === 1 ? t('farmers.farmerFound') : t('farmers.farmersFound')}
                        {selectedDistrict && ` ${t('farmers.inDistrict', { district: selectedDistrict })}`}
                    </Text>
                </View>

                <DistrictFilter />

                <View className="px-5">
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