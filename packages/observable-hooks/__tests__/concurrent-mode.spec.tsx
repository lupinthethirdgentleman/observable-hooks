import * as RxType from 'rxjs'

let Scheduler: import('./utils').Scheduler
let React: typeof import('react')
let ReactTestRenderer: typeof import('react-test-renderer')
let act: typeof import('react-test-renderer').act
let ObservableHooks: typeof import('../src')
let Rx: typeof import('rxjs')

describe('Concurrent Mode', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.mock('scheduler', () => require('scheduler/unstable_mock'))
    jest.mock('react', () => require('experimental_react'))
    jest.mock('react-dom', () => require('experimental_react-dom'))
    jest.mock('react-test-renderer', () =>
      require('experimental_react-test-renderer')
    )

    ObservableHooks = require('../src')
    React = require('react')
    ReactTestRenderer = require('react-test-renderer')
    Scheduler = require('scheduler')

    Rx = require('rxjs')

    act = ReactTestRenderer.act
  })

  describe('useObservableState', () => {
    it('should not tear if a mutation occurs during a concurrent update', () => {
      jest.useFakeTimers()

      const input$ = new Rx.Subject<string>()

      const Subscriber = ({ id }: { id: string }) => {
        const value = ObservableHooks.useObservableState(input$, 'A')
        Scheduler.unstable_yieldValue(`render:${id}:${value}`)
        return (value as unknown) as React.ReactElement
      }

      act(() => {
        ReactTestRenderer.create(
          <React.Fragment>
            <Subscriber id="first" />
            <Subscriber id="second" />
          </React.Fragment>,
          { unstable_isConcurrent: true } as any
        )
        expect(Scheduler).toFlushAndYield(['render:first:A', 'render:second:A'])

        // Update state "A" -> "B"
        // This update will be eagerly evaluated,
        // so the tearing case this test is guarding against would not happen.
        input$.next('B')
        expect(Scheduler).toFlushAndYield(['render:first:B', 'render:second:B'])

        // No more pending updates
        jest.runAllTimers()

        // Partial update "B" -> "C"
        // Interrupt with a second mutation "C" -> "D".
        // This update will not be eagerly evaluated,
        // but useObservableState() should eagerly close over the updated value to avoid tearing.
        input$.next('C')
        expect(Scheduler).toFlushAndYieldThrough(['render:first:C'])
        input$.next('D')
        expect(Scheduler).toFlushAndYield([
          'render:second:C',
          'render:first:D',
          'render:second:D'
        ])

        // No more pending updates
        jest.runAllTimers()
      })
    })
  })

  describe('ObservableResource', () => {
    it('should not tear if a mutation occurs during a concurrent update', () => {
      jest.useFakeTimers()

      const input$ = new Rx.BehaviorSubject<string>('A')
      const resource = new ObservableHooks.ObservableResource(input$)

      const Subscriber = ({ id }: { id: string }) => {
        const value = ObservableHooks.useObservableSuspense(resource)
        Scheduler.unstable_yieldValue(`render:${id}:${value}`)
        return (value as unknown) as React.ReactElement
      }

      act(() => {
        ReactTestRenderer.create(
          <React.Fragment>
            <Subscriber id="first" />
            <Subscriber id="second" />
          </React.Fragment>,
          { unstable_isConcurrent: true } as any
        )
        expect(Scheduler).toFlushAndYield(['render:first:A', 'render:second:A'])

        // Update state "A" -> "B"
        // This update will be eagerly evaluated,
        // so the tearing case this test is guarding against would not happen.
        input$.next('B')
        expect(Scheduler).toFlushAndYield(['render:first:B', 'render:second:B'])

        // No more pending updates
        jest.runAllTimers()

        // Partial update "B" -> "C"
        // Interrupt with a second mutation "C" -> "D".
        // This update will not be eagerly evaluated,
        // but useObservableState() should eagerly close over the updated value to avoid tearing.
        input$.next('C')
        expect(Scheduler).toFlushAndYieldThrough(['render:first:C'])
        input$.next('D')
        expect(Scheduler).toFlushAndYield([
          'render:second:C',
          'render:first:D',
          'render:second:D'
        ])

        // No more pending updates
        jest.runAllTimers()
      })
    })
  })
})
