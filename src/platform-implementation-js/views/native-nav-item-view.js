/* @flow */

import EventEmitter from '../lib/safe-event-emitter';
import Kefir from 'kefir';
import kefirCast from 'kefir-cast';
import defer from '../../common/defer';
import get from '../../common/get-or-fail';
import NavItemView from './nav-item-view';

import type { Driver } from '../driver-interfaces/driver';
import type GmailNavItemView from '../dom-driver/gmail/views/gmail-nav-item-view';

const memberMap = new WeakMap();

export default class NativeNavItemView extends EventEmitter {
  constructor(
    appId: string,
    driver: Driver,
    labelName: string,
    navItemViewDriverPromise: Promise<GmailNavItemView>
  ) {
    super();

    const members = {
      appId,
      driver,
      labelName,
      navItemViews: [],
      navItemViewDriver: (null: ?GmailNavItemView),
      navItemViewDriverPromise,
    };
    memberMap.set(this, members);

    navItemViewDriverPromise.then((navItemViewDriver) => {
      if (!navItemViewDriver) {
        return;
      }
      members.navItemViewDriver = navItemViewDriver;
      navItemViewDriver
        .getEventStream()
        .onValue((event) => _handleStreamEvent(this, event));
    });
  }

  addNavItem(navItemDescriptor: Object): NavItemView {
    const members = get(memberMap, this);

    const navItemDescriptorPropertyStream = kefirCast(
      (Kefir: any),
      navItemDescriptor
    ).toProperty();
    const childNavItemView = new NavItemView(
      members.appId,
      members.driver,
      navItemDescriptorPropertyStream,
      members.navItemViewDriverPromise.then((navItemViewDriver) => {
        const childNavItemViewDriver = navItemViewDriver.addNavItem(
          members.appId,
          navItemDescriptorPropertyStream
        );
        return childNavItemViewDriver;
      })
    );

    members.navItemViews.push(childNavItemView);
    return childNavItemView;
  }

  isCollapsed(): boolean {
    return (
      localStorage.getItem(
        'inboxsdk__nativeNavItem__state_' + get(memberMap, this).labelName
      ) === 'collapsed'
    );
  }

  setCollapsed(collapseValue: boolean) {
    const members = get(memberMap, this);

    if (members.navItemViewDriver) {
      members.navItemViewDriver.setCollapsed(collapseValue);
    } else {
      localStorage.setItem(
        'inboxsdk__nativeNavItem__state_' + members.labelName,
        collapseValue ? 'collapsed' : 'expanded'
      );
    }
  }
}

function _handleStreamEvent(emitter, event) {
  switch (event.eventName) {
    case 'expanded':
    case 'collapsed':
      emitter.emit(event.eventName);
      break;
  }
}
