import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React, { useContext } from "react";
import { ActivityIndicator, View } from "react-native";

import { AuthContext } from "../auth/AuthContext";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { GamificationScreen } from "../screens/GamificationScreen";
// import { GroupCreateScreen } from "../screens/GroupCreateScreen";
// import { GroupDetailScreen } from "../screens/GroupDetailScreen";
// import { GroupJoinScreen } from "../screens/GroupJoinScreen";
// import { GroupsScreen } from "../screens/GroupsScreen";
import { HabitDetailScreen } from "../screens/HabitDetailScreen";
import { HabitFormScreen } from "../screens/HabitFormScreen";
import { HabitsScreen } from "../screens/HabitsScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";

const AuthStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const HabitsStack = createNativeStackNavigator();
const GroupsStack = createNativeStackNavigator();

function FullscreenLoading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: "login" }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: "Register" }} />
    </AuthStack.Navigator>
  );
}

function HabitsNavigator() {
  return (
    <HabitsStack.Navigator>
      <HabitsStack.Screen name="HabitsHome" component={HabitsScreen} options={{ title: "Habit" }} />
      <HabitsStack.Screen name="HabitForm" component={HabitFormScreen} options={{ title: "Create/edit habits" }} />
      <HabitsStack.Screen name="HabitDetail" component={HabitDetailScreen} options={{ title: "Details of habits\n"}} />
    </HabitsStack.Navigator>
  );
}

function GroupsNavigator() {
  return (
    <GroupsStack.Navigator>
      <GroupsStack.Screen name="GroupsHome" component={GroupsScreen} options={{ title: "Group" }} />
      <GroupsStack.Screen name="GroupCreate" component={GroupCreateScreen} options={{ title: "Create Group" }} />
      <GroupsStack.Screen name="GroupJoin" component={GroupJoinScreen} options={{ title: "Enter Group" }} />
      <GroupsStack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: "Group details\n"}} />
    </GroupsStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Habits" component={HabitsNavigator} options={{ title: "Habits" }} />
      <Tabs.Screen name="Gamification" component={GamificationScreen} options={{ title: "Gamification" }} />
      <Tabs.Screen name="Groups" component={GroupsNavigator} options={{ title: "Groups" }} />
      <Tabs.Screen name="Analytics" component={AnalyticsScreen} options={{ title: "Analytics" }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: "Mine" }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");

  return (
    <NavigationContainer>
      {auth.state.status === "loading" ? <FullscreenLoading /> : auth.state.status === "signedIn" ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
