import authorizenet from "authorizenet";
const { APIContracts, APIControllers, Constants } = authorizenet;

function getMerchantAuth(): APIContracts.MerchantAuthenticationType {
  const merchantAuth = new APIContracts.MerchantAuthenticationType();
  merchantAuth.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID!);
  merchantAuth.setTransactionKey(process.env.AUTHORIZE_NET_TRANSACTION_KEY!);
  return merchantAuth;
}

function getEnvironment(): string {
  const env = (process.env.AUTHORIZE_NET_ENVIRONMENT || "sandbox").toLowerCase();
  return env === "production"
    ? Constants.endpoint.production
    : Constants.endpoint.sandbox;
}

export interface ChargeResult {
  success: boolean;
  transactionId: string;
  authCode: string;
  accountNumber: string;
  accountType: string;
}

export interface ChargeError {
  success: false;
  errorCode: string;
  errorMessage: string;
}

export async function chargePaymentNonce(
  amount: number,
  dataDescriptor: string,
  dataValue: string,
  orderDescription: string,
  customerEmail?: string,
  customerName?: string,
): Promise<ChargeResult> {
  return new Promise((resolve, reject) => {
    const merchantAuth = getMerchantAuth();

    const opaqueData = new APIContracts.OpaqueDataType();
    opaqueData.setDataDescriptor(dataDescriptor);
    opaqueData.setDataValue(dataValue);

    const paymentType = new APIContracts.PaymentType();
    paymentType.setOpaqueData(opaqueData);

    const orderDetails = new APIContracts.OrderType();
    orderDetails.setDescription(orderDescription.substring(0, 255));

    const transactionRequestType = new APIContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(
      APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION
    );
    transactionRequestType.setPayment(paymentType);
    transactionRequestType.setAmount(amount);
    transactionRequestType.setOrder(orderDetails);

    if (customerEmail) {
      const customer = new APIContracts.CustomerDataType();
      customer.setEmail(customerEmail);
      transactionRequestType.setCustomer(customer);
    }

    if (customerName) {
      const billTo = new APIContracts.CustomerAddressType();
      const parts = customerName.trim().split(/\s+/);
      billTo.setFirstName(parts[0] || "");
      billTo.setLastName(parts.slice(1).join(" ") || parts[0] || "");
      transactionRequestType.setBillTo(billTo);
    }

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequestType);

    const ctrl = new APIControllers.CreateTransactionController(
      createRequest.getJSON()
    );
    ctrl.setEnvironment(getEnvironment());

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.CreateTransactionResponse(apiResponse);

      if (response === null) {
        return reject({
          success: false,
          errorCode: "NULL_RESPONSE",
          errorMessage: "No response from payment gateway",
        } as ChargeError);
      }

      if (
        response.getMessages().getResultCode() ===
        APIContracts.MessageTypeEnum.OK
      ) {
        const txnResponse = response.getTransactionResponse();
        if (txnResponse && txnResponse.getMessages()) {
          return resolve({
            success: true,
            transactionId: txnResponse.getTransId(),
            authCode: txnResponse.getAuthCode(),
            accountNumber: txnResponse.getAccountNumber() || "",
            accountType: txnResponse.getAccountType() || "",
          });
        }

        if (txnResponse && txnResponse.getErrors()) {
          const err = txnResponse.getErrors().getError()[0];
          return reject({
            success: false,
            errorCode: err.getErrorCode(),
            errorMessage: err.getErrorText(),
          } as ChargeError);
        }
      }

      const txnResponse = response.getTransactionResponse();
      if (txnResponse && txnResponse.getErrors()) {
        const err = txnResponse.getErrors().getError()[0];
        return reject({
          success: false,
          errorCode: err.getErrorCode(),
          errorMessage: err.getErrorText(),
        } as ChargeError);
      }

      const msg = response.getMessages().getMessage()[0];
      return reject({
        success: false,
        errorCode: msg.getCode(),
        errorMessage: msg.getText(),
      } as ChargeError);
    });
  });
}

export function getPublicConfig() {
  return {
    apiLoginId: process.env.AUTHORIZE_NET_API_LOGIN_ID,
    clientKey: process.env.AUTHORIZE_NET_PUBLIC_CLIENT_KEY,
    environment: (process.env.AUTHORIZE_NET_ENVIRONMENT || "sandbox").toLowerCase(),
  };
}
