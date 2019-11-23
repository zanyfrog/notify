import { Component, OnDestroy, OnInit, ApplicationRef } from '@angular/core';
import { EventResponse } from '../interfaces';
import { Subscription, interval, concat } from 'rxjs';
import { first } from 'rxjs/operators';
import { EventsService } from '../events.service';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import { Network } from '@ngx-pwa/offline';
import { SwUpdate, UpdateActivatedEvent, UpdateAvailableEvent } from '@angular/service-worker';
import { async } from 'q';

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
	events: EventResponse[] = [];
	subscriptions: Subscription [] = [];
	online$ = this.network.onlineChanges;

	constructor(
		private alertController: AlertController,
		private appRef: ApplicationRef,
		private eventService: EventsService,
		private nav: NavController,
		private network: Network,
		private updater: SwUpdate,
		private toastController: ToastController
	) {
		console.log('Home Page');
	}

	ngOnInit(): void {
		this.subscriptions.push(this.eventService.getAll()
			.subscribe(e => this.events.push(e)));

		this.initUpdater();
	}

	ngOnDestroy(): void {
		this.subscriptions.forEach(sub => sub.unsubscribe());
	}

	initUpdater()
	{
		// Allow the app to stabilize first, before starting polling for updates with 'interval()'.

		// see https://angular.io/guide/servce-worker-communications
		const updateInterval$ = interval(1000 * 60 * 1); // 1 minute (for debugging, production should be much higher)
		const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true) );
		const appStableInterval$ = concat(appIsStable$, updateInterval$);


		this.subscriptions.push(this.updater.available.subscribe( (e) => this.onUpdateAvailable(e)));
		this.subscriptions.push(this.updater.activated.subscribe( (e) => this.onUpdateActivated(e)));
		this.subscriptions.push(appStableInterval$.subscribe( () => this.checkForUpdate()));
	}
	async checkForUpdate()
	{
		if (this.updater.isEnabled)
		{
			await this.updater.checkForUpdate();
		}
	}

	async onUpdateAvailable(event: UpdateAvailableEvent)
	{
		const updateMessageString = 'updateMessage';
		const updateMessage = event.available.appData[updateMessageString];
		console.log('A new version is available: ' , updateMessage);

		const alert = await this.alertController.create(
			{
				header: 'Update Available!'
				, message: 'A new version of the application is available. '
					+ '(Details: ${updateMessage}) '
					+ 'Click OK to update now.'
				, buttons:
				[
					{
						text: 'Now Now'
						, role: 'cancel'
						, cssClass: 'secondary'
						, handler: async () =>
						{
							this.showToastMessage('Update deferred');
						}
					},
					{  // so now update
						text: 'OK'
						, handler: async () =>
						{
							await this.updater.activateUpdate();
							window.location.reload();
						}

					}
				]

			}
		);

		await alert.present();  // show dialog
	}

	async onUpdateActivated(event: UpdateActivatedEvent)
	{
		await this.showToastMessage('Application updating.');
	}

	async showToastMessage(msg: string) {
		console.log(msg);
		const toast = await this.toastController.create({
		  message: msg,
		  duration: 2000,
		  showCloseButton: true,
		  position: 'top',
		  closeButtonText: 'OK'
		});
		toast.present();
	 }

	getEvents(): EventResponse[] {
		return this.events.sort((a, b) => a.event.created > b.event.created ? -1 : 1);
	}

	details(response: EventResponse) {
		this.nav.navigateForward('/details/${response.event.id}');
	}

}
