import { Injectable, signal, computed } from '@angular/core';

export interface ProfileItem {
  id: string;
  name: string;
  avatarUrl: string;
  isKids: boolean;
  maturityRating: string;
  hasPin: boolean;
}

export type UserProfile = ProfileItem;

@Injectable({
  providedIn: 'root'
})
export class ProfileStore {
  private static loadInitialProfiles(): ProfileItem[] {
    const saved = localStorage.getItem('ott_user_profiles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    const user = JSON.parse(localStorage.getItem('ott_user') || 'null');
    const profileName = user?.name || user?.fullName || 'Main Profile';
    return [
      {
        id: 'p1',
        name: profileName,
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&q=80',
        isKids: false,
        maturityRating: 'ALL',
        hasPin: false
      }
    ];
  }

  private readonly profilesSignal = signal<ProfileItem[]>(ProfileStore.loadInitialProfiles());

  private readonly activeProfileSignal = signal<ProfileItem | null>(
    JSON.parse(localStorage.getItem('ott_active_profile') || 'null') || this.profilesSignal()[0]
  );

  readonly activeProfile = computed(() => this.activeProfileSignal());
  readonly allProfiles = computed(() => this.profilesSignal());
  readonly isKidsMode = computed(() => this.activeProfileSignal()?.isKids ?? false);

  setActiveProfile(profile: ProfileItem): void {
    localStorage.setItem('ott_active_profile', JSON.stringify(profile));
    this.activeProfileSignal.set(profile);
  }

  addProfile(profile: ProfileItem): void {
    this.profilesSignal.update(list => {
      const updated = [...list, profile];
      localStorage.setItem('ott_user_profiles', JSON.stringify(updated));
      return updated;
    });
  }
}
