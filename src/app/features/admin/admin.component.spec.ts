import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AdminComponent } from './admin.component';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../services/user.service';
import { ApiService } from '../../services/api.service';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;

  beforeEach(async () => {
    const adminServiceStub = {
      getUsers: () => of([]),
      getAdmins: () => of([]),
      getArtists: () => of([]),
      getSongs: () => of([]),
      getRecentDeletions: () => of([]),
      updateUserRole: () => of({}),
      createArtist: () => of({}),
      deleteUser: () => of({}),
      createSong: () => of({}),
      deleteSong: () => of({}),
      deleteArtist: () => of({}),
      undoDeletion: () => of({}),
      createAlbum: () => of({})
    };

    const authServiceStub = {
      isAdmin: () => true
    };

    const userServiceStub = {
      getProfile: () => of(null)
    };

    const apiServiceStub = {
      getAssetUrl: (value: string) => value
    };

    await TestBed.configureTestingModule({
      declarations: [AdminComponent],
      imports: [FormsModule, RouterTestingModule],
      providers: [
        { provide: AdminService, useValue: adminServiceStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: UserService, useValue: userServiceStub },
        { provide: ApiService, useValue: apiServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
