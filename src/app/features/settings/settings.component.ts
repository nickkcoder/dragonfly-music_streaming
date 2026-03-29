import { Component, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';
import { ArtistService } from '../../core/services/artist.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, ThemeType } from '../../core/services/theme.service';
import { ApiService } from '../../services/api.service';
import { BugReportService } from '../../core/services/bug-report.service';

type SettingsPanel =
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'playback'
  | 'artist-tools'
  | 'support'
  | 'export'
  | 'artist'
  | 'password'
  | 'theme'
  | null;

interface PrivacySettings {
  publicProfile: boolean;
  showLikedSongs: boolean;
  showListeningActivity: boolean;
}

interface NotificationSettings {
  emailReleases: boolean;
  emailFollows: boolean;
  adminAlerts: boolean;
  marketing: boolean;
}

interface PlaybackSettings {
  autoplay: boolean;
  explicitFilter: boolean;
  defaultVolume: number;
}

interface ArtistToolSettings {
  payoutEmail: string;
  paypal: string;
  instagram: string;
  tiktok: string;
  website: string;
}

interface SettingsResponse {
  privacy?: Partial<PrivacySettings>;
  notifications?: Partial<NotificationSettings>;
  playback?: Partial<PlaybackSettings>;
  artistTools?: Partial<ArtistToolSettings>;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  activePanel: SettingsPanel = null;
  activeTheme: ThemeType = 'luxury';

  artistData = { artist_name: '', bio: '', genre: '' };
  artistBusy = false;
  artistMessage = '';
  artistError = '';
  artistGranted = false;
  role$ = this.authService.role$;
  isArtist$ = this.role$.pipe(map((role) => role === 'artist' || role === 'admin'));

  privacy: PrivacySettings = {
    publicProfile: true,
    showLikedSongs: true,
    showListeningActivity: true
  };
  notifications: NotificationSettings = {
    emailReleases: true,
    emailFollows: true,
    adminAlerts: true,
    marketing: false
  };
  playback: PlaybackSettings = {
    autoplay: true,
    explicitFilter: false,
    defaultVolume: 70
  };
  artistTools: ArtistToolSettings = {
    payoutEmail: '',
    paypal: '',
    instagram: '',
    tiktok: '',
    website: ''
  };
  settingsBusy = false;
  settingsMessage = '';
  settingsError = '';

  accountEmail = '';
  accountPassword = '';
  accountMessage = '';
  accountError = '';
  accountBusy = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  deleteConfirm = '';
  deleteMessage = '';
  deleteError = '';

  supportSubject = '';
  supportMessage = '';
  supportEmail = '';
  supportBusy = false;
  supportOk = '';
  supportError = '';

  resetEmail = '';
  resetBusy = false;
  resetMessage = '';
  resetError = '';

  bugModalOpen = false;
  bugMessage = '';
  bugEmail = '';
  bugSubmitting = false;
  bugSuccess = '';
  bugError = '';

  constructor(
    private artistService: ArtistService,
    private authService: AuthService,
    private api: ApiService,
    private themeService: ThemeService,
    private bugReportService: BugReportService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.activeTheme = this.themeService.getCurrentTheme();
  }

  selectTheme(theme: ThemeType) {
    this.activeTheme = theme;
    this.themeService.setTheme(theme);
  }

  togglePanel(panel: Exclude<SettingsPanel, null>) {
    this.activePanel = this.activePanel === panel ? null : panel;
  }

  submitArtistAccess() {
    this.artistMessage = '';
    this.artistError = '';

    if (!this.artistData.artist_name.trim()) {
      this.artistError = 'Artist name is required.';
      return;
    }

    this.artistBusy = true;
    this.artistService.becomeArtist({
      artist_name: this.artistData.artist_name.trim(),
      bio: this.artistData.bio.trim(),
      genre: this.artistData.genre.trim()
    }).subscribe({
      next: () => {
        this.artistMessage = 'Artist access granted. You can now publish releases.';
        this.artistGranted = true;
        this.artistBusy = false;
      },
      error: (err) => {
        this.artistError = err?.error?.message || 'Could not switch to artist role.';
        this.artistBusy = false;
      }
    });
  }

  loadSettings() {
    this.settingsBusy = true;
    this.api.get<SettingsResponse>('api/auth/settings').subscribe({
      next: (data) => {
        this.privacy = { ...this.privacy, ...(data?.privacy || {}) };
        this.notifications = { ...this.notifications, ...(data?.notifications || {}) };
        this.playback = { ...this.playback, ...(data?.playback || {}) };
        this.artistTools = { ...this.artistTools, ...(data?.artistTools || {}) };
        this.settingsBusy = false;
      },
      error: () => {
        this.settingsBusy = false;
      }
    });
  }

  savePrivacy() {
    this.saveSettings({ privacy: this.privacy });
  }

  saveNotifications() {
    this.saveSettings({ notifications: this.notifications });
  }

  savePlayback() {
    this.saveSettings({ playback: this.playback });
  }

  saveArtistTools() {
    this.saveSettings({ artistTools: this.artistTools });
  }

  private saveSettings(payload: SettingsResponse) {
    this.settingsMessage = '';
    this.settingsError = '';
    this.settingsBusy = true;

    this.api.put<SettingsResponse>('api/auth/settings', payload).subscribe({
      next: (data) => {
        this.privacy = { ...this.privacy, ...(data?.privacy || {}) };
        this.notifications = { ...this.notifications, ...(data?.notifications || {}) };
        this.playback = { ...this.playback, ...(data?.playback || {}) };
        this.artistTools = { ...this.artistTools, ...(data?.artistTools || {}) };
        this.settingsMessage = 'Settings updated.';
        this.settingsBusy = false;
      },
      error: (err) => {
        this.settingsError = err?.error?.message || 'Could not update settings.';
        this.settingsBusy = false;
      }
    });
  }

  updateEmail() {
    this.accountMessage = '';
    this.accountError = '';
    this.accountBusy = true;

    this.api.put<{ message?: string }>('api/auth/email', {
      email: this.accountEmail,
      password: this.accountPassword
    }).subscribe({
      next: (payload) => {
        this.accountMessage = payload?.message || 'Email updated.';
        this.accountBusy = false;
      },
      error: (err) => {
        this.accountError = err?.error?.message || 'Could not update email.';
        this.accountBusy = false;
      }
    });
  }

  updatePassword() {
    this.accountMessage = '';
    this.accountError = '';

    if (!this.newPassword || this.newPassword !== this.confirmPassword) {
      this.accountError = 'Passwords do not match.';
      return;
    }

    this.accountBusy = true;
    this.api.put<{ message?: string }>('api/auth/password', {
      current_password: this.currentPassword,
      new_password: this.newPassword
    }).subscribe({
      next: (payload) => {
        this.accountMessage = payload?.message || 'Password updated.';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.accountBusy = false;
      },
      error: (err) => {
        this.accountError = err?.error?.message || 'Could not update password.';
        this.accountBusy = false;
      }
    });
  }

  requestAccountDeletion() {
    this.deleteMessage = '';
    this.deleteError = '';

    if (this.deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      this.deleteError = 'Type DELETE to confirm.';
      return;
    }

    this.api.post<{ message?: string }>('api/auth/delete-account', {
      password: this.accountPassword
    }).subscribe({
      next: (payload) => {
        this.deleteMessage = payload?.message || 'Account deleted.';
      },
      error: (err) => {
        this.deleteError = err?.error?.message || 'Could not delete account.';
      }
    });
  }

  submitSupport() {
    this.supportOk = '';
    this.supportError = '';

    const subject = this.supportSubject.trim();
    const message = this.supportMessage.trim();
    if (!subject || !message) {
      this.supportError = 'Subject and message are required.';
      return;
    }

    this.supportBusy = true;
    this.api.post<{ message?: string }>('api/auth/support', {
      subject,
      message,
      email: this.supportEmail.trim() || undefined
    }).subscribe({
      next: (payload) => {
        this.supportOk = payload?.message || 'Support request submitted.';
        this.supportBusy = false;
      },
      error: (err) => {
        this.supportError = err?.error?.message || 'Could not submit support request.';
        this.supportBusy = false;
      }
    });
  }

  exportData() {
    this.api.get<Record<string, unknown>>('api/auth/export').subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'dragofly-export.json';
        link.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  requestPasswordReset() {
    this.resetMessage = '';
    this.resetError = '';

    const email = this.resetEmail.trim();
    if (!email) {
      this.resetError = 'Enter the email on your account.';
      return;
    }

    this.resetBusy = true;
    this.api.post<{ message?: string }>('api/auth/forgot-password', { email }).subscribe({
      next: (payload) => {
        this.resetMessage = payload?.message || 'If that email exists, we sent reset instructions.';
        this.resetBusy = false;
      },
      error: (err) => {
        this.resetError = err?.error?.message || 'Could not start password reset.';
        this.resetBusy = false;
      }
    });
  }

  openBugModal() {
    this.bugModalOpen = true;
    this.bugSuccess = '';
    this.bugError = '';
  }

  closeBugModal() {
    if (this.bugSubmitting) {
      return;
    }
    this.bugModalOpen = false;
  }

  submitBugReport() {
    const message = this.bugMessage.trim();
    if (!message) {
      this.bugError = 'Please describe the bug before submitting.';
      this.bugSuccess = '';
      return;
    }

    this.bugSubmitting = true;
    this.bugError = '';
    this.bugSuccess = '';

    this.bugReportService.report({
      message,
      email: this.bugEmail.trim() || undefined,
      page_url: window.location.pathname,
      user_agent: window.navigator.userAgent,
      reported_at: new Date().toISOString()
    }).subscribe({
      next: () => {
        this.bugSubmitting = false;
        this.bugSuccess = 'Bug report sent. Thank you.';
        this.bugMessage = '';
        this.bugEmail = '';
      },
      error: (err) => {
        this.bugSubmitting = false;
        this.bugError = err?.error?.message || 'Could not send bug report.';
      }
    });
  }
}
