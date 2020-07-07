import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';
import * as firebase from 'firebase/app';
import { HttpClient } from '@angular/common/http';
import { ResourceType } from '../data/resources';
import { Router } from '@angular/router';

export const DESTINATION_URL = 'destination-url';
export const DESTINATION_URL_PARAMS = 'destination-url-params';

const TOKEN = 'jwt-bearer-token';

export interface TokenRes {
  token: string;
}

@Injectable()
export class AuthService {
  private token;
  private availableResourcesPromise: Promise<ResourceType[]>;

  constructor(public afAuth: AngularFireAuth, private http: HttpClient) {}

  getJwtToken(): string {
    if (!this.token) {
      this.token = localStorage.getItem(TOKEN);
    }
    return this.token;
  }

  async doGoogleLogin() {
    this.doLogout();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    return await this.afAuth.auth.signInWithPopup(provider);
  }

  async doEmailPasswordRegister(
    email: string,
    password: string
  ): Promise<firebase.auth.UserCredential> {
    this.doLogout();
    return await firebase.auth().createUserWithEmailAndPassword(email, password);
  }

  async createJwtToken(name?: string): Promise<string> {
    const firebaseToken = await firebase.auth().currentUser.getIdToken();
    const jwtToken = await this.http
      .post(`${environment.apiUrl}/auth/login-partners-firebase`, { token: firebaseToken, name })
      .toPromise()
      .then((res: TokenRes) => {
        return res.token;
      });
    localStorage.setItem(TOKEN, jwtToken);
    return jwtToken;
  }

  async doEmailPasswordLogin(
    email: string,
    password: string
  ): Promise<firebase.auth.UserCredential> {
    this.doLogout();
    this.availableResourcesPromise = null;
    return await firebase.auth().signInWithEmailAndPassword(email, password);
  }

  getAvailableResources(): Promise<ResourceType[]> {
    if (!this.isLoggedIn()) {
      return Promise.resolve([]);
    }
    if (this.availableResourcesPromise) {
      return this.availableResourcesPromise;
    }
    return (this.availableResourcesPromise = this.http
      .get<ResourceType[]>(`${environment.apiUrl}/v1.1.1/auth/resources`)
      .toPromise()
      .then(resources => {
        return resources || [];
      })
      .catch(() => []));
  }

  hasAccess(actualResources: ResourceType[]): Promise<boolean> {
    return this.getAvailableResources().then(resources => {
      return actualResources.every(item => resources.includes(item));
    });
  }

  isLoggedIn(): boolean {
    return !!this.getJwtToken();
  }

  doLogout(): Promise<void> {
    localStorage.removeItem(TOKEN);
    this.token = null;
    this.availableResourcesPromise = null;
    if (firebase.auth().currentUser) {
      return this.afAuth.auth.signOut();
    }
  }

  restoreUrl(router: Router) {
    if (localStorage.getItem(DESTINATION_URL)) {
      router.navigate([localStorage.getItem(DESTINATION_URL)], {
        queryParams: {
          ...JSON.parse(localStorage.getItem(DESTINATION_URL_PARAMS))
        }
      });
      localStorage.removeItem(DESTINATION_URL);
      localStorage.removeItem(DESTINATION_URL_PARAMS);
    } else {
      router.navigate(['/']);
    }
  }
}
