import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPlannerHistory } from './planner-history';
const key = 'japan-travel.planner-history.v1';
export const plannerHistory = createPlannerHistory({
  read: () => AsyncStorage.getItem(key),
  write: value => AsyncStorage.setItem(key, value),
});
