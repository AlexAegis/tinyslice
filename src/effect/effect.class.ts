import { EMPTY, Observable, Subscription } from 'rxjs';
import { catchError, filter, finalize, tap } from 'rxjs/operators';
import { ActionPacket } from 'src/action/action-packet.interface';
import { Action } from '../action/action.class';
import { DEFAULT_EFFECT_CONFIG, EffectConfig } from './effect-config.interface';

export class Effect<T> {
	static #registered: Set<Effect<unknown>> = new Set();

	#subscription?: Subscription;
	// TODO: When available, buffer until a reducersRun notification comes
	#effectPipeline: Observable<ActionPacket<T>> = this.observable.pipe(
		catchError((error) => {
			if (this.config.logErrors) {
				console.error(error);
			}
			return EMPTY;
		}),
		filter((wrappedAction) => Action.isRegistered(wrappedAction.type)),
		tap(({ type, payload }) => Action.next<T>(type, payload)),
		finalize(() => Effect.#registered.delete(this))
	);

	private config: EffectConfig;

	public constructor(
		private readonly observable: Observable<ActionPacket<T>>,
		config: EffectConfig = DEFAULT_EFFECT_CONFIG
	) {
		this.config = {
			...DEFAULT_EFFECT_CONFIG,
			...config,
		};

		this.#effectPipeline.subscribe();
	}

	/**
	 * Keeps a subscription alive of the observable and feeds back resulting
	 * actions into the action pool
	 */
	public static from<T>(
		observable: Observable<ActionPacket<T>>,
		config: EffectConfig = DEFAULT_EFFECT_CONFIG
	): Effect<T> {
		return new Effect(observable, config).register();
	}

	public register(): this {
		this.#subscription = this.observable.subscribe();
		Effect.#registered.add(this);
		return this;
	}

	public unregister(): void {
		this.#subscription?.unsubscribe();
	}
}
