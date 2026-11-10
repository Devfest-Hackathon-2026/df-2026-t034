import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSavedTrips } from './saved-trips';
const key = 'japan-travel.saved-trips.v1';
export const savedTrips = createSavedTrips({ read: () => AsyncStorage.getItem(key), write: value => AsyncStorage.setItem(key, value) });
