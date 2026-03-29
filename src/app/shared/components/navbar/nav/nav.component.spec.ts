import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { NavbarComponent } from './nav.component';
import { AuthService } from '../../../../core/services/auth.service';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;

  beforeEach(async () => {
    const authServiceStub = {
      isLoggedIn$: of(false),
      role$: of(''),
      isAdmin$: of(false)
    };

    await TestBed.configureTestingModule({
      declarations: [NavbarComponent],
      imports: [FormsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authServiceStub }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show a role badge when there is no role', () => {
    expect(component.shouldShowRoleBadge('', false)).toBeFalse();
    expect(component.getRoleBadgeLabel('', false)).toBe('');
  });
});
