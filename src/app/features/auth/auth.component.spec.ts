import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthComponent } from './auth.component';
import { AuthService } from '../../core/services/auth.service';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;

  beforeEach(async () => {
    const authServiceStub = {
      login: () => of({}),
      register: () => of({})
    };

    await TestBed.configureTestingModule({
      declarations: [ AuthComponent ],
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authServiceStub }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should lock and restore page scroll with lifecycle', () => {
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });
});
