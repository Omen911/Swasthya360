export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight?: number;
  height?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dosha?: 'Vata' | 'Pitta' | 'Kapha' | 'Unknown';
  calorieGoal?: number;
  createdAt: string;
}

export interface Favorite {
  id: string;
  uid: string;
  remedyId: string;
  name: string;
  category: string;
  savedAt: string;
}

export interface HealthLog {
  id: string;
  uid: string;
  date: string;
  calories: number;
  foodItems: string[];
  updatedAt: string;
}

export interface Herb {
  name: string;
  scientificName: string;
  benefits: string[];
  uses: string;
  precautions: string;
  history: string;
  imageUrl: string;
  wikiUrl: string;
}
