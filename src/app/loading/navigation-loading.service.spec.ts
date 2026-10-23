import { vi } from 'vitest';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withNavigationErrorHandler, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NavigationLoadingService } from './navigation-loading.service';

@Component({ template: '<p>Current page and edits remain available</p>' })
class CurrentPage {}
@Component({ template: '<p>Destination loaded</p>' })
class DestinationPage {}

describe('Navigation loading and recovery', () => {
  it('keeps the current screen after a failed download, resolves navigation safely, and retries the full URL', async () => {
    let fail = true;
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'current', component: CurrentPage },
      { path: 'destination', loadComponent: async () => {
        if (fail) throw new TypeError('Failed to fetch dynamically imported module');
        return DestinationPage;
      } },
    ], withRouterConfig({ resolveNavigationPromiseOnError: true }),
    withNavigationErrorHandler(error => inject(NavigationLoadingService).failed(error)))] });
    const state = TestBed.inject(NavigationLoadingService);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create('/current');
    expect(await router.navigateByUrl('/destination?view=one#details')).toBe(false);
    expect(state.loading()).toBe(false);
    expect(state.failure()).toEqual({ url: '/destination?view=one#details', module: true });
    expect(harness.routeNativeElement?.textContent).toContain('edits remain available');
    fail = false;
    await state.retry();
    harness.detectChanges();
    expect(state.failure()).toBeNull();
    expect(state.loading()).toBe(false);
    expect(router.url).toBe('/destination?view=one#details');
    expect(harness.routeNativeElement?.textContent).toContain('Destination loaded');
  });

  it('shows pending navigation and respects a cancelled leave guard on retry', async () => {
    let leave = true;
    let rejectLoad!: (reason: Error) => void;
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'current', component: CurrentPage, canDeactivate: [() => leave] },
      { path: 'destination', loadComponent: () => new Promise<typeof DestinationPage>((_, reject) => { rejectLoad = reject; }) },
    ], withRouterConfig({ resolveNavigationPromiseOnError: true }),
    withNavigationErrorHandler(error => inject(NavigationLoadingService).failed(error)))] });
    const state = TestBed.inject(NavigationLoadingService);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create('/current');
    const navigation = router.navigateByUrl('/destination');
    await vi.waitFor(() => expect(rejectLoad).toBeDefined());
    expect(state.loading()).toBe(true);
    rejectLoad(new TypeError('Importing a module script failed.'));
    await navigation;
    leave = false;
    await state.retry();
    expect(state.loading()).toBe(false);
    expect(router.url).toBe('/current');
    expect(harness.routeNativeElement?.textContent).toContain('edits remain available');
  });
});
