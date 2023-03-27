import { useState, useEffect, useCallback } from 'react'
import cn from 'classnames'
import accountPresets from 'ambire-common/src/constants/accountPresets'

import { isFirefox } from 'lib/isFirefox'
import { askForPermission } from 'lib/permissions'
import { fetchGet } from 'lib/fetch'

import { useModals, usePermissions } from 'hooks'
import { useToasts } from 'hooks/toasts'
import { Modal, Toggle, Button, Checkbox, ToolTip } from 'components/common'

import { AiOutlineReload } from 'react-icons/ai'
import { BiExport } from 'react-icons/bi'
import { MdOutlineCheck } from 'react-icons/md'

import styles from './PermissionsModal.module.scss'

const toastErrorMessage = (name) =>
  `You blocked the ${name} permission. Check your browser permissions tab.`

const PermissionsModal = ({
  relayerIdentityURL,
  account,
  onAddAccount,
  isCloseBtnShown,
  isBackupOptout,
  showThankYouPage
}) => {
  const { hideModal } = useModals()
  const { isNoticationsGranted, isClipboardGranted, modalHidden, setModalHidden } = usePermissions()
  const { addToast } = useToasts()
  const [isEmailConfirmed, setEmailConfirmed] = useState(false)
  const [isEmailResent, setEmailResent] = useState(false)
  const [isJsonBackupDownloaded, setIsJsonBackupDownloaded] = useState(isBackupOptout)
  const [resendTimeLeft, setResendTimeLeft] = useState(60000)

  const days = Math.ceil(accountPresets.quickAccTimelock / 86400)
  const areBlockedPermissions = (!isFirefox() && !isClipboardGranted) || !isNoticationsGranted
  // Because of already existing, old accounts which would be not confirmed yet.
  const isAccountNotConfirmed = account.emailConfRequired && !isEmailConfirmed
  const buttonDisabled = isAccountNotConfirmed || (!modalHidden && areBlockedPermissions)
  const sendConfirmationEmail = async () => {
    try {
      const response = await fetchGet(`${relayerIdentityURL}/resend-verification-email`)
      if (!response.success) throw new Error('Relayer did not return success.')

      addToast('Verification email sent!')
      setEmailResent(true)
    } catch (e) {
      console.error(e)
      addToast(`Could not resend verification email.${e.message}` || e, { error: true })
      setEmailResent(false)
    }
  }

  const checkEmailConfirmation = useCallback(async () => {
    try {
      const identity = await fetchGet(relayerIdentityURL)
      if (identity) {
        const { emailConfirmed } = identity.meta
        const isConfirmed = !!emailConfirmed
        setEmailConfirmed(isConfirmed)

        if (isConfirmed && account.emailConfRequired) {
          onAddAccount({
            ...account,
            emailConfRequired: false
          })
        }
      }
    } catch (e) {
      console.error(e)
      addToast('Could not check email confirmation.', { error: true })
    }
  }, [relayerIdentityURL, account, onAddAccount, addToast])

  const requestNotificationsPermission = async () => {
    const status = await askForPermission('notifications')
    if (!status) addToast(toastErrorMessage('Notifications'), { error: true })
  }

  const requestClipboardPermission = async () => {
    const status = await askForPermission('clipboard-read')
    if (!status) addToast(toastErrorMessage('Clipboard'), { error: true })
  }

  useEffect(() => {
    !isEmailConfirmed && checkEmailConfirmation()
    const emailConfirmationInterval = setInterval(
      () => !isEmailConfirmed && checkEmailConfirmation(),
      3000
    )
    return () => clearInterval(emailConfirmationInterval)
  }, [isEmailConfirmed, checkEmailConfirmation])

  const handleDoneOrIgnoreBtnsClicked = () => {
    hideModal()
    if (showThankYouPage) openThankYouPage()
  }

  const handleOnClose = () => {
    if (showThankYouPage) openThankYouPage()
  }
  const openThankYouPage = () => window.open('https://www.ambire.com/thankyou', '_blank')

  const buttons = isJsonBackupDownloaded ? (
    <>
      <Button clear small disabled={isAccountNotConfirmed} onClick={handleDoneOrIgnoreBtnsClicked}>
        Ignore
      </Button>
      <Button
        small
        primaryGradient
        disabled={buttonDisabled}
        onClick={handleDoneOrIgnoreBtnsClicked}
      >
        Done
      </Button>
    </>
  ) : (
    <>
      <Button clear small disabled onClick={handleDoneOrIgnoreBtnsClicked}>
        Ignore
      </Button>
      <Button small primaryGradient disabled onClick={handleDoneOrIgnoreBtnsClicked}>
        Done
      </Button>
    </>
  )

  const downloadFile = ({ data, fileName, fileType }) => {
    const blob = new Blob([data], { type: fileType })

    const a = document.createElement('a')
    a.download = fileName
    a.href = window.URL.createObjectURL(blob)
    const clickEvt = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    })
    a.dispatchEvent(clickEvt)
    a.remove()
  }

  const handleExportClicked = () => {
    setIsJsonBackupDownloaded(true)
    const copiedAcc = { ...account }
    console.log('copiedAcc', copiedAcc)
    if (typeof copiedAcc.emailConfRequired !== 'undefined') delete copiedAcc.emailConfRequired
    if (typeof copiedAcc.backupOptout !== 'undefined') delete copiedAcc.backupOptout
    if (typeof copiedAcc.cloudBackupOptout !== 'undefined') delete copiedAcc.cloudBackupOptout

    downloadFile({
      data: JSON.stringify(copiedAcc),
      fileName: `${copiedAcc.id}.json`,
      fileType: 'text/json'
    })

    onAddAccount({
      ...account,
      backupOptout: false
    })
  }

  useEffect(() => {
    const resendInterval = setInterval(
      () => setResendTimeLeft((resendTimeLeft) => (resendTimeLeft > 0 ? resendTimeLeft - 1000 : 0)),
      1000
    )
    return () => clearTimeout(resendInterval)
  }, [])

  return (
    <Modal
      className={styles.wrapper}
      contentClassName={styles.content}
      title="We need a few things 🙏"
      buttons={buttons}
      isCloseBtnShown={isCloseBtnShown}
      onClose={handleOnClose}
    >
      {account.email ? (
        <div className={styles.permission}>
          <div className={styles.details}>
            <div className={styles.name}>Email Verification</div>
            <div className={styles.description}>
              <b>
                Confirming your email is mandatory so that we can make sure your account can be
                recovered in case access is lost.
              </b>
              &nbsp;We already sent an email, please check your inbox.
            </div>
          </div>
          <div className={styles.status}>
            {!isEmailConfirmed ? (
              <label>
                Waiting for
                <br />
                your confirmation
              </label>
            ) : (
              <span className={styles.checkIcon}>
                <MdOutlineCheck />
              </span>
            )}
            {!isEmailConfirmed && !isEmailResent ? (
              <ToolTip
                label={`Will be available in ${resendTimeLeft / 1000} seconds`}
                disabled={resendTimeLeft === 0}
              >
                <Button
                  mini
                  clear
                  icon={<AiOutlineReload />}
                  disabled={resendTimeLeft !== 0}
                  onClick={sendConfirmationEmail}
                >
                  Resend
                </Button>
              </ToolTip>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={styles.permission}>
        <div className={styles.details}>
          <div className={styles.name}>Notifications Permission</div>
          <div className={styles.description}>
            Needed to draw your attention to Ambire Wallet when there is a transaction signing
            request.
            <br />
            You can also click the notifications to go directly to the Ambire tab.
            <br />
            We do not send any other notifications.
          </div>
        </div>
        <Toggle
          id="notifications-toggle"
          checked={isNoticationsGranted}
          onChange={() => requestNotificationsPermission()}
        />
      </div>
      <div className={cn(styles.permission, { [styles.disabled]: isFirefox() })}>
        <div className={styles.details}>
          <div className={styles.name}>
            Clipboard Permission{' '}
            {isFirefox() ? (
              <span className={styles.unavailable}>(Unavailable in Firefox)</span>
            ) : null}
          </div>
          <div className={styles.description}>
            Needed so that dApps can be connected automatically just by copying their WalletConnect
            URL.
          </div>
          {isFirefox() ? (
            <div className={styles.unavailable}>
              Without this, you can still use Ambire, but you will have to paste URLs manually
            </div>
          ) : null}
        </div>
        <Toggle
          id="clipboard-toggle"
          checked={isClipboardGranted}
          onChange={() => requestClipboardPermission()}
        />
      </div>
      {!isBackupOptout && (
        <div className={styles.permission}>
          <div className={styles.details}>
            <div className={styles.name}>Download a backup</div>
            <div className={styles.description}>
              In case you forget your password or lose your backup, <br />
              you will have to wait {days} days and pay the recovery fee to restore access to your
              account.
            </div>
          </div>
          <div className={styles.status}>
            {isJsonBackupDownloaded ? (
              <span className={styles.checkIcon}>
                <MdOutlineCheck />
              </span>
            ) : (
              <Button onClick={handleExportClicked} icon={<BiExport />}>
                Export
              </Button>
            )}
          </div>
        </div>
      )}
      {isAccountNotConfirmed ? (
        <></>
      ) : (
        // Not gonna show this at all if the email is not confirmed
        <Checkbox
          label="I understand, do not show this again."
          checked={modalHidden}
          onChange={({ target }) => setModalHidden(target.checked)}
        />
      )}
      {!isBackupOptout ? (
        <p className={styles.downloadBackup}>
          You have to download a backup of you profile before you can continue
        </p>
      ) : null}
    </Modal>
  )
}

export default PermissionsModal
