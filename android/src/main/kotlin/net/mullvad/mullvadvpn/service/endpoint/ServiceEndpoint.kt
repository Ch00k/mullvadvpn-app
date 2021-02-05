package net.mullvad.mullvadvpn.service.endpoint

import android.content.Context
import android.os.DeadObjectException
import android.os.Looper
import android.os.Messenger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ClosedReceiveChannelException
import kotlinx.coroutines.channels.actor
import kotlinx.coroutines.channels.sendBlocking
import net.mullvad.mullvadvpn.ipc.DispatchingHandler
import net.mullvad.mullvadvpn.ipc.Event
import net.mullvad.mullvadvpn.ipc.Request
import net.mullvad.mullvadvpn.service.MullvadDaemon
import net.mullvad.mullvadvpn.util.Intermittent
import net.mullvad.talpid.ConnectivityListener

class ServiceEndpoint(
    context: Context,
    looper: Looper,
    internal val intermittentDaemon: Intermittent<MullvadDaemon>,
    val connectivityListener: ConnectivityListener
) {
    private val listeners = mutableListOf<Messenger>()
    private val registrationQueue = startRegistrator()

    internal val dispatcher = DispatchingHandler(looper) { message ->
        Request.fromMessage(message)
    }

    val messenger = Messenger(dispatcher)

    val connectionProxy = ConnectionProxy(context, this)
    val settingsListener = SettingsListener(this)

    val accountCache = AccountCache(this)
    val appVersionInfoCache = AppVersionInfoCache(context, this)
    val customDns = CustomDns(this)
    val keyStatusListener = KeyStatusListener(this)
    val locationInfoCache = LocationInfoCache(this)
    val relayListListener = RelayListListener(this)
    val splitTunneling = SplitTunneling(context, this)

    init {
        dispatcher.registerHandler(Request.RegisterListener::class) { request ->
            registrationQueue.sendBlocking(request.listener)
        }
    }

    fun onDestroy() {
        dispatcher.onDestroy()
        registrationQueue.close()

        accountCache.onDestroy()
        appVersionInfoCache.onDestroy()
        connectionProxy.onDestroy()
        customDns.onDestroy()
        keyStatusListener.onDestroy()
        locationInfoCache.onDestroy()
        relayListListener.onDestroy()
        settingsListener.onDestroy()
        splitTunneling.onDestroy()
    }

    internal fun sendEvent(event: Event) {
        val deadListeners = mutableListOf<Messenger>()

        for (listener in listeners) {
            try {
                listener.send(event.message)
            } catch (_: DeadObjectException) {
                deadListeners.add(listener)
            }
        }

        for (deadListener in deadListeners) {
            listeners.remove(deadListener)
        }
    }

    private fun startRegistrator() = GlobalScope.actor<Messenger>(
        Dispatchers.Default,
        Channel.UNLIMITED
    ) {
        try {
            while (true) {
                val listener = channel.receive()

                intermittentDaemon.await()

                registerListener(listener)
            }
        } catch (exception: ClosedReceiveChannelException) {
            // Registration queue closed; stop registrator
        }
    }

    private fun registerListener(listener: Messenger) {
        listeners.add(listener)

        listener.apply {
            send(Event.LoginStatus(accountCache.onLoginStatusChange.latestEvent).message)
            send(Event.AccountHistory(accountCache.onAccountHistoryChange.latestEvent).message)
            send(Event.SettingsUpdate(settingsListener.settings).message)
            send(Event.NewLocation(locationInfoCache.location).message)
            send(Event.WireGuardKeyStatus(keyStatusListener.keyStatus).message)
            send(Event.SplitTunnelingUpdate(splitTunneling.onChange.latestEvent).message)
            send(Event.CurrentVersion(appVersionInfoCache.currentVersion).message)
            send(Event.AppVersionInfo(appVersionInfoCache.appVersionInfo).message)
            send(Event.NewRelayList(relayListListener.relayList).message)
            send(Event.ListenerReady().message)
        }
    }
}
